"""PHOIBLE 2.0 source adapter.

Downloads the canonical `phoible.csv` (~2000 languages, ~3000 inventories) and
emits:

    out/languages.json         — index of all distinct languages
    out/inventories/{iso}.json — per-language phoneme inventory

We prefer one inventory per ISO 639-3 code (the largest/most complete one) for
v1; the UI can surface inventory choice later.

Reference: https://phoible.org/  (CC BY-SA 3.0)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from tqdm import tqdm

# Canonical CSV — served from the PHOIBLE CLDF dataset on GitHub
PHOIBLE_CSV_URL = (
    "https://raw.githubusercontent.com/phoible/dev/master/data/phoible.csv"
)

# PHOIBLE feature columns — everything after "source" is a binary/ternary feature
_NON_FEATURE_COLUMNS = {
    "InventoryID",
    "Glottocode",
    "ISO6393",
    "LanguageName",
    "SpecificDialect",
    "GlyphID",
    "Phoneme",
    "Allophones",
    "Marginal",
    "SegmentClass",
    "Source",
}


def fetch(cache_dir: Path) -> Path:
    """Download phoible.csv (cached)."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / "phoible.csv"
    if target.exists() and target.stat().st_size > 1_000_000:
        return target
    print(f"Downloading PHOIBLE → {target}")
    with requests.get(PHOIBLE_CSV_URL, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        with target.open("wb") as f:
            for chunk in tqdm(
                r.iter_content(chunk_size=1 << 15),
                total=(total // (1 << 15)) if total else None,
                unit="chunk",
            ):
                f.write(chunk)
    return target


def parse(raw_path: Path) -> pd.DataFrame:
    """Load the PHOIBLE CSV into a DataFrame."""
    df = pd.read_csv(raw_path, low_memory=False)
    # Normalize a few columns
    df["Marginal"] = df["Marginal"].fillna(False).astype(bool)
    df["SegmentClass"] = df["SegmentClass"].fillna("other").str.lower()
    # Allophones are space-separated segments or NaN
    df["Allophones"] = df["Allophones"].fillna("")
    return df


def emit(df: pd.DataFrame, out: Path) -> None:
    """Write languages.json + inventories/{iso}.json."""
    out.mkdir(parents=True, exist_ok=True)
    inv_dir = out / "inventories"
    inv_dir.mkdir(exist_ok=True)

    # Feature columns = everything not in the fixed metadata set
    feature_cols = [c for c in df.columns if c not in _NON_FEATURE_COLUMNS]

    # --- Pick one inventory per ISO (largest by phoneme count) ---
    # Group by ISO and find the InventoryID with the most rows.
    iso_counts = (
        df.groupby(["ISO6393", "InventoryID"])
        .size()
        .reset_index(name="n")
        .sort_values(["ISO6393", "n"], ascending=[True, False])
    )
    chosen = iso_counts.drop_duplicates("ISO6393", keep="first")
    chosen_ids = set(chosen["InventoryID"])
    df_chosen = df[df["InventoryID"].isin(chosen_ids)].copy()

    # --- languages.json ---
    languages: list[dict[str, Any]] = []
    for (iso, inv_id), grp in df_chosen.groupby(["ISO6393", "InventoryID"]):
        if not isinstance(iso, str) or not iso:
            continue
        row0 = grp.iloc[0]
        languages.append(
            {
                "iso": iso,
                "glottocode": (
                    row0["Glottocode"]
                    if isinstance(row0["Glottocode"], str) and row0["Glottocode"]
                    else None
                ),
                "name": str(row0["LanguageName"]),
                "family": None,  # enriched by glottolog source later
                "macroarea": None,
                "latitude": None,
                "longitude": None,
                "phonemeCount": int(len(grp)),
                "sources": [f"PHOIBLE:{row0['Source']}"],
            }
        )
    languages.sort(key=lambda r: r["name"].lower())

    (out / "languages.json").write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "count": len(languages),
                "languages": languages,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"wrote languages.json  ({len(languages)} languages)")

    # --- phoneme-index.json (segment → [iso]) ---
    phoneme_to_isos: dict[str, list[str]] = {}
    for (iso, _inv_id), grp in df_chosen.groupby(["ISO6393", "InventoryID"]):
        if not isinstance(iso, str) or not iso:
            continue
        for seg in set(grp["Phoneme"]):
            phoneme_to_isos.setdefault(str(seg), []).append(iso)
    # Sort lists for deterministic output
    for k in phoneme_to_isos:
        phoneme_to_isos[k] = sorted(phoneme_to_isos[k])
    (out / "phoneme-index.json").write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "distinctSegments": len(phoneme_to_isos),
                "index": phoneme_to_isos,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    print(
        f"wrote phoneme-index.json ({len(phoneme_to_isos)} distinct segments)"
    )

    # --- inventories/{iso}.json ---
    written = 0
    for (iso, inv_id), grp in tqdm(
        df_chosen.groupby(["ISO6393", "InventoryID"]),
        desc="inventories",
        total=df_chosen[["ISO6393", "InventoryID"]].drop_duplicates().shape[0],
    ):
        if not isinstance(iso, str) or not iso:
            continue
        row0 = grp.iloc[0]
        phonemes: list[dict[str, Any]] = []
        for _, r in grp.iterrows():
            feats = {
                col: r[col]
                for col in feature_cols
                if isinstance(r[col], str) and r[col] not in ("0",)
            }
            phonemes.append(
                {
                    "segment": str(r["Phoneme"]),
                    "marginal": bool(r["Marginal"]),
                    "allophones": (
                        [a for a in str(r["Allophones"]).split() if a]
                        if r["Allophones"]
                        else []
                    ),
                    "features": feats,
                    "segmentClass": str(r["SegmentClass"]),
                }
            )
        payload = {
            "iso": iso,
            "glottocode": (
                row0["Glottocode"]
                if isinstance(row0["Glottocode"], str) and row0["Glottocode"]
                else None
            ),
            "inventoryId": int(inv_id),
            "name": str(row0["LanguageName"]),
            "source": f"PHOIBLE:{row0['Source']}",
            "phonemes": phonemes,
        }
        (inv_dir / f"{iso}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        written += 1
    print(f"wrote inventories/    ({written} files)")
