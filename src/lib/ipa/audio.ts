/**
 * IPA → Wikimedia Commons audio filename mapping.
 *
 * Commons stores IPA phoneme recordings under canonical human-readable
 * filenames (e.g. `Voiceless_bilabial_plosive.ogg`). We fetch via the
 * Special:FilePath redirect so we don't have to compute the MD5-based
 * bucket path:
 *
 *   https://commons.wikimedia.org/wiki/Special:FilePath/<Filename>
 *
 * Coverage is intentionally pragmatic — ~80 common pulmonic segments. When a
 * phoneme isn't in the map, the UI shows a "no recording" state and can fall
 * back to the nearest segment by feature distance (see spec §9).
 */

const COMMONS_BASE = 'https://commons.wikimedia.org/wiki/Special:FilePath/';

// Filename stems (without the .ogg extension). Lookups are symbol-exact.
const IPA_TO_FILE: Record<string, string> = {
  // --- Plosives ---
  p: 'Voiceless_bilabial_plosive',
  b: 'Voiced_bilabial_plosive',
  t: 'Voiceless_alveolar_plosive',
  d: 'Voiced_alveolar_stop',
  ʈ: 'Voiceless_retroflex_stop',
  ɖ: 'Voiced_retroflex_stop',
  c: 'Voiceless_palatal_plosive',
  ɟ: 'Voiced_palatal_plosive',
  k: 'Voiceless_velar_plosive',
  ɡ: 'Voiced_velar_plosive',
  q: 'Voiceless_uvular_plosive',
  ɢ: 'Voiced_uvular_stop',
  ʔ: 'Glottal_stop',

  // --- Nasals ---
  m: 'Bilabial_nasal',
  ɱ: 'Labiodental_nasal',
  n: 'Alveolar_nasal',
  ɳ: 'Retroflex_nasal',
  ɲ: 'Palatal_nasal',
  ŋ: 'Velar_nasal',
  ɴ: 'Uvular_nasal',

  // --- Trills ---
  ʙ: 'Bilabial_trill',
  r: 'Alveolar_trill',
  ʀ: 'Uvular_trill',

  // --- Taps/Flaps ---
  ⱱ: 'Labiodental_flap',
  ɾ: 'Alveolar_tap',
  ɽ: 'Retroflex_flap',

  // --- Fricatives ---
  ɸ: 'Voiceless_bilabial_fricative',
  β: 'Voiced_bilabial_fricative',
  f: 'Voiceless_labio-dental_fricative',
  v: 'Voiced_labiodental_fricative',
  θ: 'Voiceless_dental_fricative',
  ð: 'Voiced_dental_fricative',
  s: 'Voiceless_alveolar_sibilant',
  z: 'Voiced_alveolar_sibilant',
  ʃ: 'Voiceless_palato-alveolar_sibilant',
  ʒ: 'Voiced_palato-alveolar_sibilant',
  ʂ: 'Voiceless_retroflex_sibilant',
  ʐ: 'Voiced_retroflex_sibilant',
  ç: 'Voiceless_palatal_fricative',
  ʝ: 'Voiced_palatal_fricative',
  x: 'Voiceless_velar_fricative',
  ɣ: 'Voiced_velar_fricative',
  χ: 'Voiceless_uvular_fricative',
  ʁ: 'Voiced_uvular_fricative',
  ħ: 'Voiceless_pharyngeal_fricative',
  ʕ: 'Voiced_pharyngeal_fricative',
  h: 'Voiceless_glottal_fricative',
  ɦ: 'Voiced_glottal_fricative',

  // --- Lateral fricatives ---
  ɬ: 'Voiceless_alveolar_lateral_fricative',
  ɮ: 'Voiced_alveolar_lateral_fricative',

  // --- Approximants ---
  ʋ: 'Labiodental_approximant',
  ɹ: 'Alveolar_approximant',
  ɻ: 'Retroflex_approximant',
  j: 'Palatal_approximant',
  ɰ: 'Velar_approximant',

  // --- Lateral approximants ---
  l: 'Alveolar_lateral_approximant',
  ɭ: 'Retroflex_lateral_approximant',
  ʎ: 'Palatal_lateral_approximant',
  ʟ: 'Velar_lateral_approximant',

  // --- Vowels (close) ---
  i: 'Close_front_unrounded_vowel',
  y: 'Close_front_rounded_vowel',
  ɨ: 'Close_central_unrounded_vowel',
  ʉ: 'Close_central_rounded_vowel',
  ɯ: 'Close_back_unrounded_vowel',
  u: 'Close_back_rounded_vowel',
  ɪ: 'Near-close_near-front_unrounded_vowel',
  ʏ: 'Near-close_near-front_rounded_vowel',
  ʊ: 'Near-close_near-back_rounded_vowel',

  // --- Vowels (close-mid) ---
  e: 'Close-mid_front_unrounded_vowel',
  ø: 'Close-mid_front_rounded_vowel',
  ɘ: 'Close-mid_central_unrounded_vowel',
  ɵ: 'Close-mid_central_rounded_vowel',
  ɤ: 'Close-mid_back_unrounded_vowel',
  o: 'Close-mid_back_rounded_vowel',

  // --- Vowels (mid/open-mid) ---
  ə: 'Mid-central_vowel',
  ɛ: 'Open-mid_front_unrounded_vowel',
  œ: 'Open-mid_front_rounded_vowel',
  ɜ: 'Open-mid_central_unrounded_vowel',
  ɞ: 'Open-mid_central_rounded_vowel',
  ʌ: 'Open-mid_back_unrounded_vowel',
  ɔ: 'Open-mid_back_rounded_vowel',

  // --- Vowels (near-open / open) ---
  æ: 'Near-open_front_unrounded_vowel',
  ɐ: 'Near-open_central_unrounded_vowel',
  a: 'Open_front_unrounded_vowel',
  ɶ: 'Open_front_rounded_vowel',
  ɑ: 'Open_back_unrounded_vowel',
  ɒ: 'Open_back_rounded_vowel',
};

export function audioUrlFor(symbol: string): string | null {
  const stem = IPA_TO_FILE[symbol];
  if (!stem) return null;
  return `${COMMONS_BASE}${encodeURIComponent(stem)}.ogg`;
}

export function hasAudio(symbol: string): boolean {
  return symbol in IPA_TO_FILE;
}
