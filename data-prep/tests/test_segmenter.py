"""Tests for the grapheme segmenter — greedy longest-match alignment of a
word's characters to a phoneme sequence, using a per-language grapheme
inventory. See issue #1.
"""
from __future__ import annotations

import pytest

from glossa_data_prep.reconcile import (
    load_grapheme_inventory,
    segment_word,
)

# ---------------------------------------------------------------------------
# Load the English inventory once — it's the hand-authored one we test
# most heavily. fra/deu inventories get lighter smoke tests.
# ---------------------------------------------------------------------------

ENG_INV = load_grapheme_inventory("eng")
FRA_INV = load_grapheme_inventory("fra")
DEU_INV = load_grapheme_inventory("deu")


def test_inventories_load():
    assert ENG_INV, "eng inventory should load"
    assert FRA_INV, "fra inventory should load"
    assert DEU_INV, "deu inventory should load"
    # Longest-first sort means the first entry is at least as long as the last.
    assert len(ENG_INV[0]) >= len(ENG_INV[-1])


def test_inventory_missing_returns_none():
    assert load_grapheme_inventory("xyz") is None


# ---------------------------------------------------------------------------
# English — canonical cases showing digraphs are picked over single chars.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "word,phonemes,expected",
    [
        # Simple digraph at start
        ("ship", ["ʃ", "ɪ", "p"], [("sh", "ʃ"), ("i", "ɪ"), ("p", "p")]),
        # Digraph at end
        ("fish", ["f", "ɪ", "ʃ"], [("f", "f"), ("i", "ɪ"), ("sh", "ʃ")]),
        # Two digraphs in one word
        ("thing", ["θ", "ɪ", "ŋ"], [("th", "θ"), ("i", "ɪ"), ("ng", "ŋ")]),
        # No digraph available — falls through to single chars
        ("bed", ["b", "ɛ", "d"], [("b", "b"), ("e", "ɛ"), ("d", "d")]),
        # Trigraph (tch)
        ("catch", ["k", "æ", "tʃ"], [("c", "k"), ("a", "æ"), ("tch", "tʃ")]),
        # Silent-k digraph (kn)
        ("knee", ["n", "iː"], [("kn", "n"), ("ee", "iː")]),
        # Silent-w digraph (wr)
        ("write", ["r", "aɪ", "t"], None),  # no "ite" grapheme — intentional fail
        # Double-letter: 'mm' is not a grapheme, so 'hammer' would need two 'm's
        # paired with one phoneme each. Since inventory only has single 'm',
        # the word segments if phoneme count matches.
        ("ring", ["r", "ɪ", "ŋ"], [("r", "r"), ("i", "ɪ"), ("ng", "ŋ")]),
        # Trigraph 'igh' is NOT in our inventory because WikiPron splits
        # English diphthongs into 2 segments ('high' → ['h','a','ɪ']).
        # Segmenter instead picks 'h' + 'i' + 'gh' (since 'gh' is still a
        # valid single-phoneme grapheme), producing a bogus 'i'→'a'
        # mapping. Documenting this as an intentional v1 limitation —
        # eliminating it requires per-position context (v2).
        ("high", ["h", "a", "ɪ"], [("h", "h"), ("i", "a"), ("gh", "ɪ")]),
        # Diphthong graph 'oa' — excluded from inventory. 'boat' = 4 chars
        # and WikiPron gives 4 segments, so each letter pairs with one
        # phoneme. Structurally a match; linguistically the 'a'→'ʊ'
        # pairing is bogus (same v1 limitation as 'high').
        ("boat", ["b", "o", "ʊ", "t"], [("b", "b"), ("o", "o"), ("a", "ʊ"), ("t", "t")]),
        # 'ph' digraph
        ("phone", ["f", "oʊ", "n"], None),  # no grapheme absorbs final 'e'
        # Uppercase input — segmenter case-folds.
        ("SHIP", ["ʃ", "ɪ", "p"], [("sh", "ʃ"), ("i", "ɪ"), ("p", "p")]),
        # Mismatched length — can't be 1:1 no matter what
        ("cat", ["k", "æ"], None),
        # Chars outside the inventory (digit) — fails
        ("3d", ["θ", "ɹ", "iː", "d", "iː"], None),
    ],
)
def test_english_segmentation(word, phonemes, expected):
    assert segment_word(word, phonemes, ENG_INV) == expected


def test_backtracking_prefers_longest_but_retries():
    """`chop` — 'ch' consumes 2 chars, then 'o' + 'p' = 3 graphemes for
    3 phonemes. `c + h + o + p` would be 4 graphemes for 3 phonemes, so
    the segmenter MUST pick the longest-match path. Conversely, `coat`
    needs `c + oa + t` (3 graphemes) not `c + o + a + t` (4 graphemes)
    to match 3 phonemes.
    """
    assert segment_word("chop", ["tʃ", "ɒ", "p"], ENG_INV) == [
        ("ch", "tʃ"),
        ("o", "ɒ"),
        ("p", "p"),
    ]
    # 'oa' is no longer in the inventory (see eng.json _comment), so
    # 'coat' fails when WikiPron encodes the diphthong as one segment
    # (3 phonemes, 4 chars — no 1:1 split possible).
    assert segment_word("coat", ["k", "oʊ", "t"], ENG_INV) is None


def test_pure_function_no_mutation():
    """segment_word must not mutate its inputs."""
    word = "ship"
    phon = ["ʃ", "ɪ", "p"]
    inv_snapshot = list(ENG_INV)
    segment_word(word, phon, ENG_INV)
    assert phon == ["ʃ", "ɪ", "p"]
    assert ENG_INV == inv_snapshot


def test_empty_word():
    assert segment_word("", [], ENG_INV) == []
    assert segment_word("", ["p"], ENG_INV) is None
    assert segment_word("x", [], ENG_INV) is None


# ---------------------------------------------------------------------------
# French & German — spot checks.
# ---------------------------------------------------------------------------


def test_french_eau():
    # "eau" → /o/ is the poster-child French trigraph.
    assert segment_word("eau", ["o"], FRA_INV) == [("eau", "o")]
    # "bateau" → /bato/
    assert segment_word("bateau", ["b", "a", "t", "o"], FRA_INV) == [
        ("b", "b"),
        ("a", "a"),
        ("t", "t"),
        ("eau", "o"),
    ]


def test_french_ch_gn():
    # "cheval" → /ʃəval/ — 5 phonemes, needs `ch` digraph.
    assert segment_word("cheval", ["ʃ", "ə", "v", "a", "l"], FRA_INV) == [
        ("ch", "ʃ"),
        ("e", "ə"),
        ("v", "v"),
        ("a", "a"),
        ("l", "l"),
    ]
    # "agneau" → /aɲo/ — needs `gn` + `eau` trigraph
    assert segment_word("agneau", ["a", "ɲ", "o"], FRA_INV) == [
        ("a", "a"),
        ("gn", "ɲ"),
        ("eau", "o"),
    ]


def test_french_silent_consonants_return_none():
    """Many French words end in silent consonants (t, s, d, x…). Without a
    proper silent-letter model, those words can't be 1:1 aligned and the
    segmenter returns None — the entry contributes no edges. Documenting
    this as intentional v1 behavior.
    """
    # "chat" /ʃa/ has silent 't' → 4 chars, 2 phonemes, no valid split.
    assert segment_word("chat", ["ʃ", "a"], FRA_INV) is None
    # "chaud" /ʃo/ — silent 'd'
    assert segment_word("chaud", ["ʃ", "o"], FRA_INV) is None


def test_german_sch():
    # "schaf" → /ʃaːf/ in 3 phonemes
    assert segment_word("schaf", ["ʃ", "aː", "f"], DEU_INV) == [
        ("sch", "ʃ"),
        ("a", "aː"),
        ("f", "f"),
    ]
    # "tisch" → /tɪʃ/
    assert segment_word("tisch", ["t", "ɪ", "ʃ"], DEU_INV) == [
        ("t", "t"),
        ("i", "ɪ"),
        ("sch", "ʃ"),
    ]


# ---------------------------------------------------------------------------
# Additional alphabetic Latin-script languages — spa, ita, por, nld, pol.
# Light smoke tests: inventory loads and the canonical digraphs/trigraphs
# are picked up.
# ---------------------------------------------------------------------------

SPA_INV = load_grapheme_inventory("spa")
ITA_INV = load_grapheme_inventory("ita")
POR_INV = load_grapheme_inventory("por")
NLD_INV = load_grapheme_inventory("nld")
POL_INV = load_grapheme_inventory("pol")


def test_new_inventories_load():
    for name, inv in [
        ("spa", SPA_INV), ("ita", ITA_INV), ("por", POR_INV),
        ("nld", NLD_INV), ("pol", POL_INV),
    ]:
        assert inv, f"{name} inventory should load"


def test_spanish_ll_rr():
    # "llama" /ʎama/ — really /ʝ/ in most dialects, but we test alignment
    assert segment_word("llama", ["ʎ", "a", "m", "a"], SPA_INV) == [
        ("ll", "ʎ"), ("a", "a"), ("m", "m"), ("a", "a"),
    ]
    # "perro" /pero/ (rr is one phoneme)
    assert segment_word("perro", ["p", "e", "r", "o"], SPA_INV) == [
        ("p", "p"), ("e", "e"), ("rr", "r"), ("o", "o"),
    ]


def test_italian_gn_gl():
    # "gnomo" /ɲɔmo/
    assert segment_word("gnomo", ["ɲ", "ɔ", "m", "o"], ITA_INV) == [
        ("gn", "ɲ"), ("o", "ɔ"), ("m", "m"), ("o", "o"),
    ]
    # "figli" /fiʎi/
    assert segment_word("figli", ["f", "i", "ʎ", "i"], ITA_INV) == [
        ("f", "f"), ("i", "i"), ("gl", "ʎ"), ("i", "i"),
    ]


def test_portuguese_lh_nh_rr():
    # "filho" /fiʎu/ (BR) or /fiʎo/ (EU) — we just align the structure
    assert segment_word("filho", ["f", "i", "ʎ", "u"], POR_INV) == [
        ("f", "f"), ("i", "i"), ("lh", "ʎ"), ("o", "u"),
    ]
    # "carro" /kaʁu/ — rr digraph
    assert segment_word("carro", ["k", "a", "ʁ", "u"], POR_INV) == [
        ("c", "k"), ("a", "a"), ("rr", "ʁ"), ("o", "u"),
    ]


def test_dutch_aa_ng():
    # "aap" /aːp/ — aa digraph for long vowel
    assert segment_word("aap", ["aː", "p"], NLD_INV) == [
        ("aa", "aː"), ("p", "p"),
    ]
    # "lang" /lɑŋ/ — ng digraph
    assert segment_word("lang", ["l", "ɑ", "ŋ"], NLD_INV) == [
        ("l", "l"), ("a", "ɑ"), ("ng", "ŋ"),
    ]
    # 'ij' is no longer in the Dutch inventory (WikiPron splits Dutch
    # diphthongs: 'zei' → ['z','ɛ','i̯']). 'ijs' as 1 diphthong phoneme
    # can't align 1:1 with 3 chars.
    assert segment_word("ijs", ["ɛi", "s"], NLD_INV) is None


def test_polish_sz_cz_rz():
    # "szkoła" /ʂkɔwa/
    assert segment_word("szkoła", ["ʂ", "k", "ɔ", "w", "a"], POL_INV) == [
        ("sz", "ʂ"), ("k", "k"), ("o", "ɔ"), ("ł", "w"), ("a", "a"),
    ]
    # "czas" /tʂas/
    assert segment_word("czas", ["tʂ", "a", "s"], POL_INV) == [
        ("cz", "tʂ"), ("a", "a"), ("s", "s"),
    ]
