/**
 * IPA vowel trapezoid SSOT.
 *
 * Coordinates are normalized 0-1 in an F2-like (x) / F1-like (y) space:
 *   x = 0 → front, x = 1 → back
 *   y = 0 → close, y = 1 → open
 * The trapezoid shape is applied in the renderer (front row is wider than back).
 */

export interface Vowel {
  segment: string;
  /** 0 = front, 1 = back */
  backness: number;
  /** 0 = close (high), 1 = open (low) */
  height: number;
  rounded: boolean;
  /** For pair rendering — each cell on the chart has [unrounded, rounded] */
  pairWith?: string;
}

export const VOWELS: Vowel[] = [
  // Close
  { segment: 'i', backness: 0, height: 0, rounded: false, pairWith: 'y' },
  { segment: 'y', backness: 0, height: 0, rounded: true },
  { segment: 'ɨ', backness: 0.5, height: 0, rounded: false, pairWith: 'ʉ' },
  { segment: 'ʉ', backness: 0.5, height: 0, rounded: true },
  { segment: 'ɯ', backness: 1, height: 0, rounded: false, pairWith: 'u' },
  { segment: 'u', backness: 1, height: 0, rounded: true },

  // Near-close
  { segment: 'ɪ', backness: 0.15, height: 0.2, rounded: false, pairWith: 'ʏ' },
  { segment: 'ʏ', backness: 0.15, height: 0.2, rounded: true },
  { segment: 'ʊ', backness: 0.85, height: 0.2, rounded: true },

  // Close-mid
  { segment: 'e', backness: 0, height: 0.4, rounded: false, pairWith: 'ø' },
  { segment: 'ø', backness: 0, height: 0.4, rounded: true },
  { segment: 'ɘ', backness: 0.5, height: 0.4, rounded: false, pairWith: 'ɵ' },
  { segment: 'ɵ', backness: 0.5, height: 0.4, rounded: true },
  { segment: 'ɤ', backness: 1, height: 0.4, rounded: false, pairWith: 'o' },
  { segment: 'o', backness: 1, height: 0.4, rounded: true },

  // Mid
  { segment: 'ə', backness: 0.5, height: 0.55, rounded: false },

  // Open-mid
  { segment: 'ɛ', backness: 0, height: 0.7, rounded: false, pairWith: 'œ' },
  { segment: 'œ', backness: 0, height: 0.7, rounded: true },
  { segment: 'ɜ', backness: 0.5, height: 0.7, rounded: false, pairWith: 'ɞ' },
  { segment: 'ɞ', backness: 0.5, height: 0.7, rounded: true },
  { segment: 'ʌ', backness: 1, height: 0.7, rounded: false, pairWith: 'ɔ' },
  { segment: 'ɔ', backness: 1, height: 0.7, rounded: true },

  // Near-open
  { segment: 'æ', backness: 0.1, height: 0.85, rounded: false },
  { segment: 'ɐ', backness: 0.5, height: 0.85, rounded: false },

  // Open
  { segment: 'a', backness: 0, height: 1, rounded: false, pairWith: 'ɶ' },
  { segment: 'ɶ', backness: 0, height: 1, rounded: true },
  { segment: 'ɑ', backness: 1, height: 1, rounded: false, pairWith: 'ɒ' },
  { segment: 'ɒ', backness: 1, height: 1, rounded: true },
];
