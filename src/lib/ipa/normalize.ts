/**
 * Normalize IPA segments so that variants like `eː`, `d̪`, `pʰ`, `ʉ̟` match
 * their canonical base (`e`, `d`, `p`, `ʉ`) on the chart.
 *
 * PHOIBLE records phonemes with combining diacritics (dental, advanced,
 * creaky…), length markers (ː, ˑ), and spacing modifier letters (ʰ, ʲ, ʷ…).
 * The chart is built on bare IPA base symbols, so we need a lightweight
 * overlay mechanism.
 */

/** Spacing modifier letters with conventional names. */
const MODIFIER_LETTERS: Record<string, string> = {
  ʰ: 'aspirated',
  ʱ: 'breathy',
  ʷ: 'labialized',
  ʲ: 'palatalized',
  ˠ: 'velarized',
  ˤ: 'pharyngealized',
  ː: 'long',
  ˑ: 'half-long',
  ˈ: 'primary stress',
  ˌ: 'secondary stress',
};

/** Combining diacritics with conventional names (U+0300..U+036F). */
const COMBINING_DIACRITICS: Record<string, string> = {
  '\u0303': 'nasalized',       // ̃
  '\u0324': 'breathy',          // ̤
  '\u0325': 'voiceless',        // ̥
  '\u0329': 'syllabic',         // ̩
  '\u032A': 'dental',           // ̪
  '\u032C': 'voiced',           // ̬
  '\u032F': 'non-syllabic',     // ̯
  '\u0330': 'creaky',           // ̰
  '\u0331': 'macron-below',     // ̱ (dental / retracted / linguolabial — ambiguous)
  '\u031F': 'advanced',         // ̟
  '\u0320': 'retracted',        // ̠
  '\u0308': 'centralized',      // ̈
  '\u033D': 'mid-centralized',  // ̽
  '\u0318': 'ATR',              // ̘
  '\u0319': 'RTR',              // ̙
  '\u0334': 'velarized',        // ̴
  '\u030D': 'syllabic',         // ̍
  '\u02DE': 'rhotic',           // ˞
};

/**
 * Strip length markers, combining diacritics, and spacing modifier letters —
 * leaving the base IPA symbol. If the segment has no recognized modifiers,
 * returns the input unchanged.
 */
export function normalize(segment: string): string {
  let base = segment.normalize('NFD');
  // Drop combining marks in the known diacritic range.
  base = base.replace(/[\u0300-\u036F]/g, '');
  // Drop spacing modifier letters we classify as diacritics (length, stress,
  // modifier letters). We DON'T strip arbitrary U+02B0..02FF because that
  // range also contains real IPA letters (e.g. ˢ, ʃ-like glyphs).
  const modChars = Object.keys(MODIFIER_LETTERS).join('');
  const re = new RegExp(`[${escapeForRegex(modChars)}]`, 'g');
  base = base.replace(re, '');
  return base;
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ModifierInfo {
  symbol: string;
  name: string;
}

/**
 * List each modifier found on a segment, in left-to-right order. Unknown
 * combining marks are included with `name = "modifier"` so the user still
 * sees *something* rather than silent dropping.
 */
export function describeModifiers(segment: string): ModifierInfo[] {
  const decomposed = segment.normalize('NFD');
  const out: ModifierInfo[] = [];
  for (const ch of decomposed) {
    if (MODIFIER_LETTERS[ch]) {
      out.push({ symbol: ch, name: MODIFIER_LETTERS[ch] });
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036f) {
      out.push({
        symbol: ch,
        name: COMBINING_DIACRITICS[ch] ?? 'modifier',
      });
    }
  }
  return out;
}

/**
 * True if the segment has any recognized modifier on top of its base.
 */
export function hasModifier(segment: string): boolean {
  return normalize(segment) !== segment;
}
