import { useMemo } from 'react';
import { useGraphemePhoneme } from '../../hooks/useData';

interface Props {
  iso: string;
  /** Called when the user clicks a grapheme row. Parent opens GraphemeDetail. */
  onSelectGrapheme: (grapheme: string) => void;
  /** Called when the user clicks a phoneme pill. Parent opens PhonemeDetail. */
  onSelectPhoneme: (phoneme: string) => void;
}

/**
 * Grapheme list for the current language. Each row is a grapheme with its
 * phoneme targets shown as pills; clicking the grapheme opens a grapheme
 * detail panel, clicking a pill opens the phoneme detail panel. Same
 * click semantics as the Mapping tab so they feel consistent.
 */
export function GraphemeTab({ iso, onSelectGrapheme, onSelectPhoneme }: Props) {
  const { data: gp, isLoading } = useGraphemePhoneme(iso);

  const graphemes = useMemo(() => {
    if (!gp) return [];
    const byG = new Map<
      string,
      {
        grapheme: string;
        total: number;
        targets: Array<{ phoneme: string; count: number }>;
      }
    >();
    for (const m of gp.mappings) {
      const entry = byG.get(m.grapheme) ?? {
        grapheme: m.grapheme,
        total: 0,
        targets: [],
      };
      entry.total += m.count;
      entry.targets.push({ phoneme: m.phoneme, count: m.count });
      byG.set(m.grapheme, entry);
    }
    return [...byG.values()]
      .map((e) => ({
        ...e,
        targets: e.targets.sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.total - a.total);
  }, [gp]);

  if (isLoading) {
    return <p className="text-neutral-500">Loading lexicon…</p>;
  }

  if (!gp) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-500">
          No lexicon available for this language yet.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Grapheme data comes from WikiPron and covers ~15 languages at v1.
        </p>
      </div>
    );
  }

  if (graphemes.length < 3) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-500">
          Not enough grapheme↔phoneme alignments to populate this tab.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          The v1 aligner zips word characters with IPA segments 1-to-1, which
          fails for syllabaries (Hangul) and abugidas (Devanagari). Only{' '}
          {gp.mappings.length} alignment pair
          {gp.mappings.length === 1 ? '' : 's'} were recoverable.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-neutral-500">
        {graphemes.length.toLocaleString()} graphemes observed in{' '}
        {gp.mappings.reduce((a, m) => a + m.count, 0).toLocaleString()}{' '}
        alignments. Click a grapheme for its detail panel, or a phoneme pill
        for the phoneme's details.
      </p>
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {graphemes.map((g) => (
          <li
            key={g.grapheme}
            className="flex items-center gap-4 bg-white px-4 py-3 dark:bg-neutral-900"
          >
            <button
              type="button"
              onClick={() => onSelectGrapheme(g.grapheme)}
              className="inline-flex min-w-[2.5rem] items-center justify-center rounded border border-neutral-200 bg-white px-2 py-1 font-mono text-lg transition hover:border-accent hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
              title="open grapheme detail"
            >
              {g.grapheme}
            </button>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {g.targets.slice(0, 6).map((t) => {
                const share = t.count / g.total;
                return (
                  <button
                    key={t.phoneme}
                    type="button"
                    onClick={() => onSelectPhoneme(t.phoneme)}
                    className="ipa inline-flex items-center gap-1.5 rounded border border-neutral-200 bg-white px-2 py-1 text-sm transition hover:border-accent hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                    title={`${t.count.toLocaleString()} observations (${Math.round(
                      share * 100
                    )}%)${t.count <= 2 ? ' — rare, likely alignment noise' : ''}`}
                  >
                    {t.phoneme}
                    <span className="text-[10px] text-neutral-500 tabular-nums">
                      {Math.round(share * 100)}%
                    </span>
                  </button>
                );
              })}
              {g.targets.length > 6 && (
                <span className="self-center text-xs text-neutral-500">
                  +{g.targets.length - 6} more
                </span>
              )}
            </div>
            <span className="w-14 shrink-0 text-right text-xs text-neutral-500 tabular-nums">
              {g.total.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
