"""WikiPron source adapter.

Downloads per-language WikiPron TSVs from the CUNY-CL/wikipron repo, then
emits per-language lexicons and a simple 1-to-1 grapheme→phoneme alignment
summary.

Files on the remote are named `<iso-639-3>_<script>[_<dialect>]_<broad|narrow>[_filtered].tsv`
(e.g. `eng_latn_us_broad.tsv`, `deu_latn_narrow.tsv`). Each line is
`word\\tspace-separated-IPA`. `broad` ≡ phonemic (slashes), `narrow` ≡
phonetic (brackets).

For v1 we only pull the 15 "suggested" languages surfaced on the landing
page. We list the remote directory via the GitHub contents API, then filter
to files whose ISO matches our target set.

Reference: https://github.com/CUNY-CL/wikipron  (Apache 2.0)
"""
from __future__ import annotations

import json
import random
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from tqdm import tqdm

# ISO 639-3 codes we pull WikiPron lexicons for — must stay in sync with
# src/routes/Home.tsx SUGGESTED.
SUGGESTED_ISOS = [
    "eng",
    "fra",
    "spa",
    "deu",
    "ita",
    "jpn",
    "kor",
    "cmn",
    "arb",
    "rus",
    "hin",
    "por",
    "nld",
    "tur",
    "pol",
    "swe",
]

# WikiPron labels its IPA variants narrow (phonetic) vs broad (phonemic).
_KINDS = ("narrow", "broad")

_GITHUB_LIST_URL = (
    "https://api.github.com/repos/CUNY-CL/wikipron/contents/data/scrape/tsv"
)
_RAW_URL = (
    "https://raw.githubusercontent.com/CUNY-CL/wikipron/master/"
    "data/scrape/tsv/{filename}"
)

# Sampling cap per language (after shuffling if larger).
MAX_ENTRIES_PER_LANG = 2000
# Examples per phoneme in the alignment summary.
MAX_EXAMPLES_PER_PHONEME = 5


def _list_remote_tsvs(session: requests.Session) -> list[str]:
    """Ask GitHub's contents API for every TSV filename in the scrape dir."""
    r = session.get(_GITHUB_LIST_URL, timeout=60)
    r.raise_for_status()
    return [item["name"] for item in r.json() if item["name"].endswith(".tsv")]


def _is_wanted(filename: str) -> bool:
    """Filter to (suggested-iso) × (un-filtered) × (broad|narrow)."""
    if filename.endswith("_filtered.tsv"):
        # Prefer un-filtered variants — the filtered ones are a subset.
        return False
    stem = filename[: -len(".tsv")]
    bits = stem.split("_")
    if len(bits) < 3:
        return False
    iso = bits[0]
    kind = bits[-1]
    return iso in set(SUGGESTED_ISOS) and kind in _KINDS


def fetch(cache_dir: Path) -> Path:
    """Download the suggested-language TSVs into `cache_dir/wikipron/`.

    Returns the wikipron/ directory path.
    """
    root = cache_dir / "wikipron"
    root.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    try:
        all_names = _list_remote_tsvs(session)
    except requests.RequestException as e:
        raise SystemExit(f"failed to list wikipron TSVs: {e}") from e

    wanted = sorted(n for n in all_names if _is_wanted(n))
    if not wanted:
        raise SystemExit("no wikipron files matched the suggested ISOs")

    for filename in tqdm(wanted, desc="wikipron"):
        target = root / filename
        if target.exists() and target.stat().st_size > 0:
            continue
        url = _RAW_URL.format(filename=filename)
        try:
            r = session.get(url, timeout=60)
        except requests.RequestException as e:
            print(f"  ! {filename}: {e}")
            continue
        if not r.ok:
            print(f"  ! {filename}: HTTP {r.status_code}")
            continue
        target.write_bytes(r.content)

    # Clean up any stale .missing sentinels from earlier probe-based runs.
    for stale in root.glob("*.missing"):
        stale.unlink()

    return root


def _parse_tsv(path: Path, kind: str) -> list[dict[str, Any]]:
    """Parse a single TSV into a list of LexiconEntry-shaped dicts.

    `kind` is the filename's last token ("broad" or "narrow"), which maps
    directly onto the LexiconEntry.kind enum.
    """
    entries: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n").rstrip("\r")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            word = parts[0].strip()
            ipa = parts[1].strip()
            if not word or not ipa:
                continue
            segments = [s for s in ipa.split(" ") if s]
            if not segments:
                continue
            entries.append(
                {
                    "word": word,
                    "pronunciation": segments,
                    "kind": kind,  # "narrow" | "broad"
                }
            )
    return entries


def parse(raw_path: Path) -> dict[str, list[dict[str, Any]]]:
    """Walk raw_path/*.tsv → {iso: [LexiconEntry]} (sampled & capped)."""
    rng = random.Random(0xC0FFEE)
    per_iso: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for tsv in sorted(raw_path.glob("*.tsv")):
        if tsv.stem.endswith("_filtered"):
            continue
        # filename: iso_script[_dialect]_kind.tsv
        bits = tsv.stem.split("_")
        if len(bits) < 3:
            continue
        iso = bits[0]
        kind = bits[-1]
        if kind not in _KINDS:
            continue
        per_iso[iso].extend(_parse_tsv(tsv, kind))

    # Cap per language.
    capped: dict[str, list[dict[str, Any]]] = {}
    for iso, entries in per_iso.items():
        if len(entries) > MAX_ENTRIES_PER_LANG:
            rng.shuffle(entries)
            entries = entries[:MAX_ENTRIES_PER_LANG]
        capped[iso] = entries
    return capped


def _build_alignment(
    iso: str, entries: list[dict[str, Any]]
) -> dict[str, Any]:
    """1-to-1 grapheme↔phoneme counts + examples per phoneme."""
    pair_counts: Counter[tuple[str, str]] = Counter()
    examples: dict[str, list[dict[str, Any]]] = defaultdict(list)
    # Bucket words by phoneme so we can pick the shortest later.
    phoneme_words: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for e in entries:
        word = e["word"]
        segs = e["pronunciation"]
        # Zip only if lengths match — keeps the heuristic honest.
        if len(word) == len(segs):
            for ch, ph in zip(word, segs):
                pair_counts[(ch, ph)] += 1
        for ph in set(segs):
            phoneme_words[ph].append({"word": word, "ipa": segs})

    # Pick up to N shortest example words per phoneme.
    for ph, items in phoneme_words.items():
        items.sort(key=lambda x: (len(x["word"]), x["word"]))
        examples[ph] = items[:MAX_EXAMPLES_PER_PHONEME]

    mappings = [
        {"grapheme": g, "phoneme": p, "count": c}
        for (g, p), c in pair_counts.most_common()
    ]
    return {
        "iso": iso,
        "mappings": mappings,
        "examples": examples,
    }


def emit(parsed: dict[str, list[dict[str, Any]]], out: Path) -> None:
    """Write lexicons/, grapheme-phoneme/, and lexicons-index.json."""
    out.mkdir(parents=True, exist_ok=True)
    lex_dir = out / "lexicons"
    lex_dir.mkdir(exist_ok=True)
    gp_dir = out / "grapheme-phoneme"
    gp_dir.mkdir(exist_ok=True)

    now = datetime.now(timezone.utc).isoformat()
    index_items: list[dict[str, Any]] = []

    for iso in sorted(parsed):
        entries = parsed[iso]
        if not entries:
            continue

        # --- lexicon ---
        lex_payload = {
            "iso": iso,
            "script": None,
            "entries": entries,
        }
        (lex_dir / f"{iso}.json").write_text(
            json.dumps(lex_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        # --- grapheme→phoneme summary ---
        gp_payload = _build_alignment(iso, entries)
        (gp_dir / f"{iso}.json").write_text(
            json.dumps(gp_payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        narrow = sum(1 for e in entries if e["kind"] == "narrow")
        broad = sum(1 for e in entries if e["kind"] == "broad")
        index_items.append(
            {
                "iso": iso,
                "entryCount": len(entries),
                "narrow": narrow,
                "broad": broad,
                "distinctPhonemes": len(gp_payload["examples"]),
                "alignmentPairs": len(gp_payload["mappings"]),
            }
        )

    (out / "lexicons-index.json").write_text(
        json.dumps(
            {
                "generatedAt": now,
                "count": len(index_items),
                "lexicons": index_items,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        f"wrote lexicons/       ({len(index_items)} files)\n"
        f"wrote grapheme-phoneme/ ({len(index_items)} files)\n"
        f"wrote lexicons-index.json"
    )
