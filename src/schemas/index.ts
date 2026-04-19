import { z } from 'zod';

// =========================================================================
// Language metadata (one per language, aggregated in languages.json)
// =========================================================================

export const LanguageSummarySchema = z.object({
  /**
   * URL-safe identifier for this specific inventory. Equals the ISO 639-3
   * code for the primary (largest) inventory of each language, or
   * `{iso}-{inventoryId}` for additional inventories. PHOIBLE has multiple
   * inventories per ISO (e.g. ~9 variants of English), and `key` lets us
   * surface all of them without collapsing them under one banner.
   */
  key: z.string(),
  iso: z.string(),
  inventoryId: z.number().int(),
  isPrimary: z.boolean(),
  glottocode: z.string().nullable(),
  name: z.string(),
  /** PHOIBLE's SpecificDialect column, when present. */
  dialect: z.string().nullable(),
  /** Pre-formatted human label, e.g. "English (American) — Western US". */
  displayName: z.string(),
  family: z.string().nullable(),
  macroarea: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  phonemeCount: z.number().int(),
  sources: z.array(z.string()),
});
export type LanguageSummary = z.infer<typeof LanguageSummarySchema>;

export const LanguagesIndexSchema = z.object({
  generatedAt: z.string(),
  count: z.number().int(),
  languages: z.array(LanguageSummarySchema),
});
export type LanguagesIndex = z.infer<typeof LanguagesIndexSchema>;

// =========================================================================
// Phoneme inventory (one per language, at inventories/{iso}.json)
// =========================================================================

// PHOIBLE distinctive features — binary or ternary (+, -, 0)
export const FeatureValueSchema = z.enum(['+', '-', '0', '+,-', '-,+']);
export type FeatureValue = z.infer<typeof FeatureValueSchema>;

export const PhonemeSchema = z.object({
  // The IPA symbol, e.g. "p", "tʃ", "a"
  segment: z.string(),
  // Marginal / loan / etc. (PHOIBLE's Marginal column)
  marginal: z.boolean().default(false),
  // Whether allophones are listed
  allophones: z.array(z.string()).default([]),
  // Distinctive features (sparse — only non-null)
  features: z.record(z.string(), FeatureValueSchema).default({}),
  // Broad category for chart placement: 'consonant' | 'vowel' | 'tone' | 'diphthong' | 'other'
  segmentClass: z.enum(['consonant', 'vowel', 'tone', 'diphthong', 'other']),
});
export type Phoneme = z.infer<typeof PhonemeSchema>;

export const InventorySchema = z.object({
  /** See LanguageSummary.key. */
  key: z.string(),
  iso: z.string(),
  glottocode: z.string().nullable(),
  inventoryId: z.union([z.string(), z.number()]),
  isPrimary: z.boolean().default(true),
  name: z.string(),
  dialect: z.string().nullable().default(null),
  displayName: z.string().default(''),
  source: z.string(),
  phonemes: z.array(PhonemeSchema),
});
export type Inventory = z.infer<typeof InventorySchema>;

// =========================================================================
// Phoneme → languages index (segment -> [iso])
// =========================================================================

export const PhonemeIndexSchema = z.object({
  generatedAt: z.string(),
  distinctSegments: z.number().int(),
  index: z.record(z.string(), z.array(z.string())),
});
export type PhonemeIndex = z.infer<typeof PhonemeIndexSchema>;

// =========================================================================
// Audio index (ipa symbol -> url)
// =========================================================================

export const AudioIndexSchema = z.record(
  z.string(),
  z.object({
    url: z.string().url(),
    title: z.string(),
    license: z.string(),
    approximated: z.boolean().default(false),
  })
);
export type AudioIndex = z.infer<typeof AudioIndexSchema>;

// =========================================================================
// Lexicon (WikiPron pairs — one per language, at lexicons/{iso}.json)
// =========================================================================

export const LexiconEntrySchema = z.object({
  word: z.string(),
  // space-separated IPA segments (preserved from WikiPron format)
  pronunciation: z.array(z.string()),
  // kind: 'narrow' (IPA in [..]) | 'broad' (phonemic in /../)
  kind: z.enum(['narrow', 'broad']),
});
export type LexiconEntry = z.infer<typeof LexiconEntrySchema>;

export const LexiconSchema = z.object({
  iso: z.string(),
  script: z.string().nullable(),
  entries: z.array(LexiconEntrySchema),
});
export type Lexicon = z.infer<typeof LexiconSchema>;

// =========================================================================
// Grapheme ↔ phoneme mappings (derived from WikiPron alignments)
// =========================================================================

export const GraphemePhonemeEntrySchema = z.object({
  grapheme: z.string(),
  phoneme: z.string(),
  count: z.number().int(),
  examples: z.array(z.string()).default([]),
});
export type GraphemePhonemeEntry = z.infer<typeof GraphemePhonemeEntrySchema>;

export const ExampleWordSchema = z.object({
  word: z.string(),
  ipa: z.array(z.string()),
});
export type ExampleWord = z.infer<typeof ExampleWordSchema>;

export const GraphemePhonemeSchema = z.object({
  iso: z.string(),
  mappings: z.array(GraphemePhonemeEntrySchema),
  examples: z.record(z.string(), z.array(ExampleWordSchema)),
  /**
   * Keyed by `"{grapheme}|{phoneme}"` — ordered short words that produced
   * that alignment pair. Optional for back-compat with older bundles.
   */
  edgeExamples: z.record(z.string(), z.array(z.string())).default({}),
});
export type GraphemePhoneme = z.infer<typeof GraphemePhonemeSchema>;

export const LexiconsIndexSchema = z.object({
  generatedAt: z.string(),
  count: z.number().int(),
  lexicons: z.array(
    z.object({
      iso: z.string(),
      entryCount: z.number().int(),
      narrow: z.number().int(),
      broad: z.number().int(),
      distinctPhonemes: z.number().int(),
      alignmentPairs: z.number().int(),
    })
  ),
});
export type LexiconsIndex = z.infer<typeof LexiconsIndexSchema>;
