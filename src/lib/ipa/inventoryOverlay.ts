import type { Inventory } from '../../schemas';
import { allConsonantSegments } from './consonants';
import { VOWELS } from './vowels';
import { describeModifiers, normalize, type ModifierInfo } from './normalize';

const CANONICAL_SEGMENTS = new Set([
  ...allConsonantSegments(),
  ...VOWELS.map((v) => v.segment),
]);

export interface VariantGroup {
  /** Canonical base symbol on the chart (e.g. 'e', 'd'). */
  base: string;
  /** Inventory segments that normalize to this base (e.g. ['eː'], ['d̪']). */
  variants: string[];
  /** Modifier descriptors for each variant, parallel to `variants`. */
  modifiers: ModifierInfo[][];
}

export interface InventoryOverlay {
  /** Chart bases to highlight (union of exact matches and normalized-variant bases). */
  activeBases: Set<string>;
  /** Full inventory segments broken down by segmentClass for quick lookup. */
  tones: string[];
  diphthongs: string[];
  /**
   * Map from a canonical chart base → the inventory segment(s) that realize it.
   * Click handler on a chart tile looks up the base and opens the detail for
   * the first variant (usually there's only one).
   */
  baseToInventory: Map<string, string[]>;
  /**
   * On-chart bases that have a modified variant in the inventory (e.g. Swedish
   * `e` is realized as `eː`, `d` as `d̪`). Useful for showing length/diacritic
   * badges on the chart and a dedicated Variants panel.
   */
  modifiedVariants: VariantGroup[];
  /**
   * Segments that don't match any canonical base even after normalization.
   * Truly off-chart: exotic clusters, placeless symbols, multi-char diphthongs
   * PHOIBLE didn't tag as 'diphthong', etc.
   */
  offChart: string[];
}

export function buildInventoryOverlay(inventory: Inventory): InventoryOverlay {
  const activeBases = new Set<string>();
  const baseToInventory = new Map<string, string[]>();
  const variantGroupsByBase = new Map<string, VariantGroup>();
  const offChart: string[] = [];
  const tones: string[] = [];
  const diphthongs: string[] = [];

  for (const p of inventory.phonemes) {
    const seg = p.segment;

    if (p.segmentClass === 'tone') {
      tones.push(seg);
      continue;
    }
    if (p.segmentClass === 'diphthong') {
      diphthongs.push(seg);
      continue;
    }

    // Exact match on the canonical chart — easy case.
    if (CANONICAL_SEGMENTS.has(seg)) {
      activeBases.add(seg);
      pushToMap(baseToInventory, seg, seg);
      continue;
    }

    // Try normalizing — strip length/diacritics/modifier letters.
    const base = normalize(seg);
    if (base && CANONICAL_SEGMENTS.has(base)) {
      activeBases.add(base);
      pushToMap(baseToInventory, base, seg);

      const mods = describeModifiers(seg);
      const group =
        variantGroupsByBase.get(base) ??
        ({ base, variants: [], modifiers: [] } satisfies VariantGroup);
      group.variants.push(seg);
      group.modifiers.push(mods);
      variantGroupsByBase.set(base, group);
      continue;
    }

    // Truly off-chart.
    offChart.push(seg);
  }

  return {
    activeBases,
    baseToInventory,
    tones,
    diphthongs,
    modifiedVariants: [...variantGroupsByBase.values()].sort((a, b) =>
      a.base.localeCompare(b.base)
    ),
    offChart,
  };
}

function pushToMap<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}
