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
