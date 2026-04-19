import type { VariantGroup } from '../../lib/ipa/inventoryOverlay';

interface Props {
  diphthongs: string[];
  tones: string[];
  modifiedVariants: VariantGroup[];
  offChart: string[];
  onSelect: (segment: string) => void;
}

/**
 * The "everything the pulmonic chart doesn't cover" section. Each subgroup
 * only renders if it has content. Clicking any tile opens the detail panel
 * for that phoneme via the shared onSelect handler.
 */
export function Suprasegmentals({
  diphthongs,
  tones,
  modifiedVariants,
  offChart,
  onSelect,
}: Props) {
  const hasAnything =
    diphthongs.length > 0 ||
    tones.length > 0 ||
    modifiedVariants.length > 0 ||
    offChart.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="space-y-8">
      {diphthongs.length > 0 && (
        <Block
          title="Diphthongs"
          count={diphthongs.length}
          onSelect={onSelect}
          segments={diphthongs}
        />
      )}

      {tones.length > 0 && (
        <Block
          title="Tones & accents"
          count={tones.length}
          onSelect={onSelect}
          segments={tones}
          hint="Superscript digits and tone letters mark pitch patterns or register."
        />
      )}

      {modifiedVariants.length > 0 && (
        <VariantsBlock
          groups={modifiedVariants}
          onSelect={onSelect}
        />
      )}

      {offChart.length > 0 && (
        <Block
          title="Other segments"
          count={offChart.length}
          onSelect={onSelect}
          segments={offChart}
          hint="Segments that don't fit the canonical pulmonic grid."
        />
      )}
    </div>
  );
}

function Block({
  title,
  count,
  segments,
  hint,
  onSelect,
}: {
  title: string;
  count: number;
  segments: string[];
  hint?: string;
  onSelect: (s: string) => void;
}) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
        {title} <span className="font-normal">({count})</span>
      </h3>
      {hint && (
        <p className="mb-3 text-xs text-neutral-500">{hint}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {segments.map((seg, i) => (
          <button
            type="button"
            key={`${seg}-${i}`}
            onClick={() => onSelect(seg)}
            className="ipa rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-base shadow-sm transition hover:border-accent dark:border-neutral-800 dark:bg-neutral-900"
          >
            {seg}
          </button>
        ))}
      </div>
    </section>
  );
}

function VariantsBlock({
  groups,
  onSelect,
}: {
  groups: VariantGroup[];
  onSelect: (s: string) => void;
}) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Variants & modifiers{' '}
        <span className="font-normal">
          ({groups.reduce((a, g) => a + g.variants.length, 0)})
        </span>
      </h3>
      <p className="mb-3 text-xs text-neutral-500">
        These inventory segments realize a chart base with a length marker or
        diacritic — e.g. a long vowel, a dental stop.
      </p>
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {groups.map((g) => (
          <li
            key={g.base}
            className="flex items-center gap-3 bg-white px-4 py-2.5 dark:bg-neutral-900"
          >
            <span className="ipa w-8 shrink-0 text-base text-neutral-500">
              {g.base}
            </span>
            <span className="text-neutral-400">→</span>
            <div className="flex flex-1 flex-wrap gap-2">
              {g.variants.map((v, i) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onSelect(v)}
                  className="ipa inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm transition hover:border-accent hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                >
                  {v}
                  {g.modifiers[i].length > 0 && (
                    <span className="text-[10px] font-normal text-neutral-500">
                      {g.modifiers[i].map((m) => m.name).join(', ')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
