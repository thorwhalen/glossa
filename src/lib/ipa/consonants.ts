/**
 * Canonical IPA pulmonic consonant chart layout (IPA 2020).
 *
 * This is the SSOT for the consonant grid. A language's inventory is an
 * overlay: phonemes present → highlighted tiles; phonemes absent → dim strokes.
 *
 * Grid: rows = manner, columns = place. Each cell holds up to two phonemes
 * (voiceless, voiced). `null` = no symbol exists at that cell in the IPA.
 * `'shaded'` = IPA considers that articulation impossible.
 */

export const CONSONANT_MANNERS = [
  'Plosive',
  'Nasal',
  'Trill',
  'Tap/Flap',
  'Fricative',
  'Lateral fricative',
  'Approximant',
  'Lateral approximant',
] as const;

export type Manner = (typeof CONSONANT_MANNERS)[number];

export const CONSONANT_PLACES = [
  'Bilabial',
  'Labiodental',
  'Dental',
  'Alveolar',
  'Postalveolar',
  'Retroflex',
  'Palatal',
  'Velar',
  'Uvular',
  'Pharyngeal',
  'Glottal',
] as const;

export type Place = (typeof CONSONANT_PLACES)[number];

export type Cell =
  | { kind: 'pair'; voiceless: string | null; voiced: string | null }
  | { kind: 'shaded' };

/**
 * Rows ordered as CONSONANT_MANNERS. Columns ordered as CONSONANT_PLACES.
 * Each cell is a pair of (voiceless, voiced) or 'shaded' if the IPA considers
 * that articulation impossible.
 */
export const CONSONANT_GRID: Cell[][] = [
  // Plosive
  [
    { kind: 'pair', voiceless: 'p', voiced: 'b' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: 't', voiced: 'd' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: 'ʈ', voiced: 'ɖ' },
    { kind: 'pair', voiceless: 'c', voiced: 'ɟ' },
    { kind: 'pair', voiceless: 'k', voiced: 'ɡ' },
    { kind: 'pair', voiceless: 'q', voiced: 'ɢ' },
    { kind: 'shaded' },
    { kind: 'pair', voiceless: 'ʔ', voiced: null },
  ],
  // Nasal
  [
    { kind: 'pair', voiceless: null, voiced: 'm' },
    { kind: 'pair', voiceless: null, voiced: 'ɱ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'n' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ɳ' },
    { kind: 'pair', voiceless: null, voiced: 'ɲ' },
    { kind: 'pair', voiceless: null, voiced: 'ŋ' },
    { kind: 'pair', voiceless: null, voiced: 'ɴ' },
    { kind: 'shaded' },
    { kind: 'shaded' },
  ],
  // Trill
  [
    { kind: 'pair', voiceless: null, voiced: 'ʙ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'r' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ʀ' },
    { kind: 'shaded' },
    { kind: 'shaded' },
  ],
  // Tap/Flap
  [
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ⱱ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ɾ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ɽ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'shaded' },
    { kind: 'shaded' },
  ],
  // Fricative
  [
    { kind: 'pair', voiceless: 'ɸ', voiced: 'β' },
    { kind: 'pair', voiceless: 'f', voiced: 'v' },
    { kind: 'pair', voiceless: 'θ', voiced: 'ð' },
    { kind: 'pair', voiceless: 's', voiced: 'z' },
    { kind: 'pair', voiceless: 'ʃ', voiced: 'ʒ' },
    { kind: 'pair', voiceless: 'ʂ', voiced: 'ʐ' },
    { kind: 'pair', voiceless: 'ç', voiced: 'ʝ' },
    { kind: 'pair', voiceless: 'x', voiced: 'ɣ' },
    { kind: 'pair', voiceless: 'χ', voiced: 'ʁ' },
    { kind: 'pair', voiceless: 'ħ', voiced: 'ʕ' },
    { kind: 'pair', voiceless: 'h', voiced: 'ɦ' },
  ],
  // Lateral fricative
  [
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: 'ɬ', voiced: 'ɮ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'shaded' },
    { kind: 'shaded' },
  ],
  // Approximant
  [
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ʋ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ɹ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ɻ' },
    { kind: 'pair', voiceless: null, voiced: 'j' },
    { kind: 'pair', voiceless: null, voiced: 'ɰ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'shaded' },
    { kind: 'shaded' },
  ],
  // Lateral approximant
  [
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'l' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'pair', voiceless: null, voiced: 'ɭ' },
    { kind: 'pair', voiceless: null, voiced: 'ʎ' },
    { kind: 'pair', voiceless: null, voiced: 'ʟ' },
    { kind: 'pair', voiceless: null, voiced: null },
    { kind: 'shaded' },
    { kind: 'shaded' },
  ],
];

/** All segments present on the grid. Useful for SSOT validation. */
export function allConsonantSegments(): string[] {
  const out: string[] = [];
  for (const row of CONSONANT_GRID) {
    for (const cell of row) {
      if (cell.kind === 'pair') {
        if (cell.voiceless) out.push(cell.voiceless);
        if (cell.voiced) out.push(cell.voiced);
      }
    }
  }
  return out;
}
