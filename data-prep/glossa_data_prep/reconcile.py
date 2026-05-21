"""WikiPron → PHOIBLE inventory reconciliation.

WikiPron and PHOIBLE use different IPA conventions — WikiPron writes broad
phonemic transcriptions (plain ASCII-like IPA), PHOIBLE annotates with
combining diacritics for detailed phonetic distinctions. Left unreconciled,
the Mapping graph edges point to WikiPron symbols that don't appear on the
IPA chart, confusing users.

This module builds a per-language canonicalization map from WikiPron's
phonemes to the PHOIBLE inventory segments. Strategy, most-specific first:

    1. exact match         — WP phoneme IS a PHOIBLE inventory segment
    2. strip-length match  — WP `aː` → PHOIBLE `aː` or `a` if no long variant
    3. tie-bar match       — WP `d͡ʒ` → PHOIBLE `dʒ` (strip U+0361)
    4. full normalize      — strip all diacritics and modifier letters;
                             matches WP `a` → PHOIBLE `a̟`, WP `k` → `kʰ`
    5. unreconciled        — true orphan; keep as-is, flag it

We also drop non-phoneme prosodic markers (stress, linking) from the
pronunciation sequence BEFORE alignment so they never produce edges.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Callable, Optional

# Segments that are prosodic markers, not phonemes. Strip them entirely
# from pronunciation sequences before alignment.
PROSODIC_MARKERS = frozenset(
    {
        "ˈ",  # primary stress
        "ˌ",  # secondary stress
        "‿",  # undertie (liaison marker)
        ".",  # syllable break
        "|",  # minor intonation group
        "‖",  # major intonation group
    }
)

# Combining tie bar (U+0361) joins two chars into one logical unit (affricates).
_TIE_BAR = "\u0361"

# Modifier letters we consider "diacritic-like" when normalizing.
_MODIFIER_LETTERS = frozenset("ːˑˈˌʰʱʷʲˠˤ")


def _strip_combining(s: str) -> str:
    """Drop all Unicode combining marks (U+0300..U+036F)."""
    decomposed = unicodedata.normalize("NFD", s)
    return "".join(c for c in decomposed if not (0x0300 <= ord(c) <= 0x036F))


def _strip_tie_bar(s: str) -> str:
    return s.replace(_TIE_BAR, "")


def _normalize(s: str) -> str:
    """Mirror of the TS normalize(): strip combining marks + modifier letters."""
    out = _strip_combining(s)
    out = re.sub(f"[{''.join(_MODIFIER_LETTERS)}]", "", out)
    return out


def strip_prosody(pronunciation: list[str]) -> list[str]:
    """Remove segments that are prosodic markers, not phonemes."""
    return [s for s in pronunciation if s not in PROSODIC_MARKERS]


def build_canonicalizer(
    inventory_segments: list[str],
) -> Callable[[str], Optional[str]]:
    """Given a PHOIBLE inventory's segments, return a resolver function.

    Call `resolve(wp_symbol)`:
      - Returns the matching PHOIBLE segment (after progressive relaxation),
      - or None if the symbol is a true orphan.
    """
    inv = list(inventory_segments)
    exact: set[str] = set(inv)
    by_no_length: dict[str, str] = {}
    by_no_tie: dict[str, str] = {}
    by_full_norm: dict[str, str] = {}

    for seg in inv:
        no_length = re.sub("[ːˑ]", "", seg)
        by_no_length.setdefault(no_length, seg)
        by_no_tie.setdefault(_strip_tie_bar(seg), seg)
        by_full_norm.setdefault(_normalize(seg), seg)

    cache: dict[str, Optional[str]] = {}

    def resolve(wp: str) -> Optional[str]:
        if wp in cache:
            return cache[wp]
        result: Optional[str]
        if wp in exact:
            result = wp
        elif (no_len_wp := re.sub("[ːˑ]", "", wp)) in exact:
            result = no_len_wp
        elif no_len_wp in by_no_length:
            result = by_no_length[no_len_wp]
        elif (no_tie_wp := _strip_tie_bar(wp)) in exact:
            result = no_tie_wp
        elif no_tie_wp in by_no_tie:
            result = by_no_tie[no_tie_wp]
        elif (norm_wp := _normalize(wp)) in by_full_norm:
            result = by_full_norm[norm_wp]
        else:
            result = None
        cache[wp] = result
        return result

    return resolve


def load_inventory_segments(out_dir: Path, iso: str) -> list[str] | None:
    """Read the already-emitted PHOIBLE inventory file for `iso` and return its
    segment list. None if the file doesn't exist (phoible source hasn't been
    run yet, or the language has no inventory)."""
    path = out_dir / "inventories" / f"{iso}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return [p["segment"] for p in data.get("phonemes", [])]


# ---------------------------------------------------------------------------
# Grapheme segmentation (digraphs, trigraphs)
# ---------------------------------------------------------------------------
#
# A language's *functional grapheme* is the smallest unit of writing that
# maps to one phoneme. For alphabets with a shallow orthography that's one
# character, but for English (`sh`, `ch`, `ough`), French (`eau`, `ai`),
# German (`sch`, `pf`) etc. graphemes are multi-character. We model them as
# a per-language list of allowed grapheme strings. See issue #1.

GRAPHEME_INVENTORIES_DIR = Path(__file__).parent.parent / "grapheme-inventories"


def load_grapheme_inventory(iso: str) -> list[str] | None:
    """Read `data-prep/grapheme-inventories/{iso}.json` → sorted-long-first
    list of allowed graphemes. Returns None if no file exists for this
    language — callers should fall back to single-character alignment.

    The inventory is sorted longest-first here so the segmenter can do
    greedy longest-match without re-sorting on every call.
    """
    path = GRAPHEME_INVENTORIES_DIR / f"{iso}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    graphemes = data["graphemes"] if isinstance(data, dict) else data
    # Lowercase + dedupe + length-desc sort. Lowercasing matches how
    # segment_word compares: we casefold both sides.
    seen: set[str] = set()
    out: list[str] = []
    for g in graphemes:
        lg = g.casefold()
        if lg and lg not in seen:
            seen.add(lg)
            out.append(lg)
    out.sort(key=lambda s: (-len(s), s))
    return out


def segment_word(
    word: str,
    phonemes: list[str],
    grapheme_inventory: list[str],
) -> list[tuple[str, str]] | None:
    """Greedy longest-match segmentation of `word` into graphemes from the
    inventory, paired 1:1 with the phoneme sequence.

    Returns a list `[(grapheme, phoneme), ...]` of length `len(phonemes)`
    whose graphemes concatenate back to `word` (case-folded), or `None`
    when no valid 1:1 split exists. Backtracks on longest-match dead-ends.

    The inventory must already be sorted longest-first (call
    `load_grapheme_inventory` or pre-sort); this function does NOT sort,
    to keep the hot path cheap.

    Pure function — no I/O, no globals.
    """
    w = word.casefold()
    n_ph = len(phonemes)
    n_w = len(w)

    # Fast-path trivial case: equal length AND inventory has all single
    # characters we need. Falls through to the full search otherwise.
    def _search(wi: int, pi: int, acc: list[tuple[str, str]]) -> list[tuple[str, str]] | None:
        if wi == n_w and pi == n_ph:
            return acc
        if wi >= n_w or pi >= n_ph:
            return None
        remaining_w = n_w - wi
        remaining_p = n_ph - pi
        # Pruning: each grapheme consumes >=1 char of word and exactly one
        # phoneme. If we have more phonemes left than word-chars left, no
        # split is possible. Cheap bailout, big speedup on impossible cases.
        if remaining_p > remaining_w:
            return None
        for gr in grapheme_inventory:
            if gr and w.startswith(gr, wi):
                acc.append((gr, phonemes[pi]))
                result = _search(wi + len(gr), pi + 1, acc)
                if result is not None:
                    return result
                acc.pop()
        return None

    return _search(0, 0, [])


# ---------------------------------------------------------------------------
# Word frequency (used to pick *recognizable* example words)
# ---------------------------------------------------------------------------
#
# Without frequency data, examples for each edge are picked by "shortest
# word first" — a crude proxy that often surfaces surnames, abbreviations,
# or rare short words ("Ng", "SHU", "ashy") instead of everyday words.
# wordfreq ships per-language Zipf frequencies for ~40 languages and lets
# us pick words that a reader is actually likely to recognize.
#
# The natural data primitive for glossa's explanatory UI is a triple
# (grapheme, phoneme, best_example_word) — see the issue #1 note on this.
# This helper is what makes `best_example_word` meaningful.

# ISO 639-3 → wordfreq's ISO 639-1 / BCP-47 code. Only listed explicitly
# when wordfreq has data; unknown codes → `best_example_key` returns None
# and callers fall back to length-based sort.
_ISO_TO_WORDFREQ: dict[str, str] = {
    "eng": "en",
    "deu": "de",
    "fra": "fr",
    "spa": "es",
    "ita": "it",
    "por": "pt",
    "nld": "nl",
    "pol": "pl",
    "rus": "ru",
    "tur": "tr",
    "hin": "hi",
    "arb": "ar",
    "swe": "sv",
    # Croatian / Serbian share wordfreq's "sh" (Serbo-Croatian) data.
    "hrv": "sh",
    "srp": "sh",
    # jpn/kor/cmn need MeCab/jieba — intentionally left out. Those
    # languages are also the ones in this issue's "out of scope" list.
}


def best_example_key(iso: str) -> Callable[[str], tuple] | None:
    """Return a sort key function for example words for this language, or
    None if wordfreq has no data for it.

    The returned key is suitable for `sorted(..., key=key)` — lower sort
    value = better (more recognizable) example. Words not in the frequency
    table get +inf and sort last, behind anything that IS known.

    Secondary key is word length (shorter wins among equally-frequent
    words), tertiary is alphabetical for determinism.
    """
    code = _ISO_TO_WORDFREQ.get(iso)
    if code is None:
        return None
    try:
        from wordfreq import zipf_frequency
    except ImportError:
        return None

    def key(word: str) -> tuple:
        # zipf_frequency picks the best wordlist wordfreq has for the
        # language (large → small) and returns 0.0 for unknown words. We
        # treat 0.0 as "worse than any known word" via +inf fallback.
        z = zipf_frequency(word, code)
        primary = -z if z > 0 else float("inf")
        return (primary, len(word), word)

    return key
