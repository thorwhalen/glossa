import {
  GraphemePhonemeSchema,
  InventorySchema,
  LanguagesIndexSchema,
  LexiconSchema,
  LexiconsIndexSchema,
  PhonemeIndexSchema,
  type GraphemePhoneme,
  type Inventory,
  type LanguagesIndex,
  type Lexicon,
  type LexiconsIndex,
  type PhonemeIndex,
} from '../schemas';

/**
 * Thin data-loading facade. Every on-disk JSON is validated with Zod so
 * schema drift surfaces immediately rather than silently poisoning the UI.
 */

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

async function loadJson(path: string): Promise<unknown> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`fetch ${path}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchLanguagesIndex(): Promise<LanguagesIndex> {
  const raw = await loadJson(`${DATA_BASE}/languages.json`);
  return LanguagesIndexSchema.parse(raw);
}

export async function fetchInventory(iso: string): Promise<Inventory> {
  const raw = await loadJson(`${DATA_BASE}/inventories/${iso}.json`);
  return InventorySchema.parse(raw);
}

export async function fetchPhonemeIndex(): Promise<PhonemeIndex> {
  const raw = await loadJson(`${DATA_BASE}/phoneme-index.json`);
  return PhonemeIndexSchema.parse(raw);
}

export async function fetchLexicon(iso: string): Promise<Lexicon | null> {
  try {
    const raw = await loadJson(`${DATA_BASE}/lexicons/${iso}.json`);
    return LexiconSchema.parse(raw);
  } catch (err) {
    // 404 is expected — not every language has a WikiPron lexicon.
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }
}

export async function fetchGraphemePhoneme(
  iso: string
): Promise<GraphemePhoneme | null> {
  try {
    const raw = await loadJson(`${DATA_BASE}/grapheme-phoneme/${iso}.json`);
    return GraphemePhonemeSchema.parse(raw);
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }
}

export async function fetchLexiconsIndex(): Promise<LexiconsIndex | null> {
  try {
    const raw = await loadJson(`${DATA_BASE}/lexicons-index.json`);
    return LexiconsIndexSchema.parse(raw);
  } catch (err) {
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }
}
