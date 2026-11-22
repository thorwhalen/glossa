# Grapheme ↔ phoneme alignment

How the data prep turns a WikiPron entry (a word and its IPA segments) into grapheme → phoneme edges for the Mapping graph and the Graphemes tab, and where it is known to fall short. Issue: [thorwhalen/glossa#1](https://github.com/thorwhalen/glossa/issues/1).

## The unit: a functional grapheme

A grapheme here is the smallest unit of writing that corresponds to one phoneme, so English `sh`, French `eau` and German `sch` are each one grapheme. Each language that has an inventory under `data-prep/grapheme-inventories/{iso}.json` lists its graphemes (multi-letter ones first); `load_grapheme_inventory` sorts them longest first.

## The segmenter (v1)

`reconcile.segment_word(word, phonemes, inventory)` splits the case-folded word into graphemes from the inventory, greedy longest match with backtracking, and accepts a split only if it has exactly as many graphemes as there are phonemes. It returns the `(grapheme, phoneme)` pairs, or `None` when no such split exists; a word that returns `None` contributes no edges at all, which is better than the bogus one-letter edges (`s→ʃ` plus `h→ʃ` for "sh") the v0 alignment produced. Languages without an inventory keep v0: a word aligns letter by letter only when it has as many letters as segments.

The split is chosen by count, not by sound: nothing checks that `sh` maps to a sibilant. In practice the inventories make the longest-match split the right one, but a word whose letters and phonemes happen to line up differently can produce a wrong edge.

## Coverage

Words segmented out of the 2,000 per language in the cached lexicons (`~/.local/share/glossa/data/lexicons`), measured 2026-11-22 with `_build_alignment`:

| iso | segmented | v0 (letter count = segment count) |
|---|---|---|
| eng | 1021 (51%) | |
| fra | 1182 (59%) | |
| deu | 1103 (55%) | |
| ita | 1877 (94%) | |
| spa | 1874 (94%) | |
| por | 1490 (74%) | |
| nld | 1576 (79%) | |
| pol | 1570 (78%) | |
| swe | 1573 (79%) | 1088 |
| hrv | 1967 (98%) | 1802 |
| srp | 1971 (99%) | 1971 |
| rus | 1506 (75%) | 1302 |

Turkish has no inventory on purpose: its alphabet is one letter per phoneme, and an inventory segmented one word fewer than v0. Japanese, Korean, Mandarin, Arabic and Hindi are not alphabets in this sense; their units (kana syllables, hangul blocks, characters, abjad and abugida letters) are separate questions (the issue's "Later" list).

## Known limitations

- **Silent letters inside a word** (English `knee`, `debt`; French `doigt`) have no grapheme that absorbs them, so the word does not segment. French word-final silent consonants are handled by folding common endings into the vowel grapheme (`-aud`, `-ent`, `-ain`, `-eaux`, …); an ending the inventory does not list still fails.
- **One letter, two phonemes**: English `x` /ks/, Russian word-initial `я` /ja/, Polish `ą` before a stop. A 1:1 split is impossible, so these words are skipped.
- **Diphthongs split by WikiPron**: WikiPron writes most diphthongs as two segments, so diphthong spellings (`oa`, `ai`, `ij`, `au`) are not in the English, Dutch and German inventories; they segment letter by letter when the count allows.
- **Polyphonic graphemes**: French `oi` is /wa/ (two segments). Swedish `k`, `g` and `sk` before front vowels (`kör`, `göra`, `skina`) are softened, but they are single letters here and segment only when the count matches.
- **Canonicalisation**: phonemes are mapped onto the PHOIBLE inventory first (`reconcile.build_canonicalizer`), so an edge can read `ть→t̪` where WikiPron wrote `tʲ`.

## Next

The principled segmenter is EM many-to-many alignment (Jiampojamarn et al., NAACL 2007), which learns the inventory and the alignment from the lexicon itself and can model silent letters and one-to-two mappings. Words that still mis-segment can be corrected by the overlays mechanism (README, "Where corrective edits will go").
