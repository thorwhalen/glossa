import type { Phoneme } from '../schemas';

/**
 * Group PHOIBLE features into readable buckets for the detail panel.
 *
 * PHOIBLE features are camelCase (e.g. `delayedRelease`, `retractedTongueRoot`).
 * We split them into semantically coherent groups so a reader scanning the
 * panel can orient quickly.
 */

const GROUPS: Array<{ label: string; features: string[] }> = [
  {
    label: 'Major class',
    features: ['consonantal', 'sonorant', 'syllabic', 'continuant'],
  },
  {
    label: 'Laryngeal',
    features: [
      'periodicGlottalSource',
      'spreadGlottis',
      'constrictedGlottis',
      'epilaryngealSource',
      'fortis',
      'lenis',
    ],
  },
  {
    label: 'Place',
    features: [
      'labial',
      'labiodental',
      'round',
      'coronal',
      'dorsal',
      'anterior',
      'distributed',
      'strident',
      'retractedTongueRoot',
      'advancedTongueRoot',
    ],
  },
  {
    label: 'Manner',
    features: [
      'delayedRelease',
      'approximant',
      'tap',
      'trill',
      'nasal',
      'lateral',
      'click',
    ],
  },
  {
    label: 'Vowel quality',
    features: [
      'high',
      'low',
      'front',
      'back',
      'tense',
      'short',
      'long',
      'stress',
      'raisedLarynxEjective',
      'loweredLarynxImplosive',
    ],
  },
];

function humanize(feature: string): string {
  // camelCase → space-separated
  return feature.replace(/([A-Z])/g, ' $1').toLowerCase();
}

export interface FeatureGroup {
  label: string;
  entries: Array<{ feature: string; display: string; value: '+' | '-' }>;
}

/**
 * Return only features that are `+` or `-`. Skips `0` (not applicable) values.
 * Ordered by our groupings; features outside the groups go in "Other".
 */
export function groupedFeatures(phoneme: Phoneme): FeatureGroup[] {
  const feats = phoneme.features;
  const seen = new Set<string>();
  const result: FeatureGroup[] = [];

  for (const g of GROUPS) {
    const entries: FeatureGroup['entries'] = [];
    for (const f of g.features) {
      const v = feats[f];
      if (v === '+' || v === '-') {
        entries.push({ feature: f, display: humanize(f), value: v });
        seen.add(f);
      }
    }
    if (entries.length) result.push({ label: g.label, entries });
  }

  // Catch-all for anything else
  const leftovers: FeatureGroup['entries'] = [];
  for (const [f, v] of Object.entries(feats)) {
    if (seen.has(f)) continue;
    if (v === '+' || v === '-') {
      leftovers.push({ feature: f, display: humanize(f), value: v });
    }
  }
  if (leftovers.length) result.push({ label: 'Other', entries: leftovers });

  return result;
}
