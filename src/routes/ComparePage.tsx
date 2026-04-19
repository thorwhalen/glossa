import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useInventory, useLanguagesIndex } from '../hooks/useData';
import { useAudio } from '../hooks/useAudio';
import { IpaConsonantChart } from '../features/chart/IpaConsonantChart';
import { IpaVowelChart } from '../features/chart/IpaVowelChart';

/**
 * Compare two languages' phoneme inventories side by side. The primary
 * language comes from `/compare/:iso`, the secondary is chosen via a picker
 * or query param `?with=xyz`.
 */
export function ComparePage() {
  // `:iso` URL param is actually a language key (may be ISO or `iso-invId`).
  const { iso: key } = useParams<{ iso: string }>();
  const [params, setParams] = useSearchParams();
  const otherKey = params.get('with') ?? null;

  const a = useInventory(key);
  const b = useInventory(otherKey ?? undefined);
  const { data: langsData } = useLanguagesIndex();
  const { play } = useAudio();

  const aSet = useMemo(
    () => new Set(a.data?.phonemes.map((p) => p.segment) ?? []),
    [a.data]
  );
  const bSet = useMemo(
    () => new Set(b.data?.phonemes.map((p) => p.segment) ?? []),
    [b.data]
  );

  const shared = useMemo(
    () => new Set([...aSet].filter((s) => bSet.has(s))),
    [aSet, bSet]
  );
  const onlyA = useMemo(
    () => [...aSet].filter((s) => !bSet.has(s)).sort(),
    [aSet, bSet]
  );
  const onlyB = useMemo(
    () => [...bSet].filter((s) => !aSet.has(s)).sort(),
    [aSet, bSet]
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <nav className="mb-6 text-sm">
        <Link to={`/lang/${key}`} className="text-accent hover:underline">
          ← back to {a.data?.displayName ?? a.data?.name ?? key}
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Compare</h1>
        {a.data && (
          <p className="mt-1 text-sm text-neutral-500">
            {a.data.displayName || a.data.name}{' '}
            <span className="mx-1 text-neutral-400">vs.</span>
            {b.data ? b.data.displayName || b.data.name : '—'}
          </p>
        )}
      </header>

      {langsData && (
        <div className="mb-8 flex items-center gap-2 text-sm">
          <label htmlFor="other" className="text-neutral-500">
            Compare with:
          </label>
          <select
            id="other"
            value={otherKey ?? ''}
            onChange={(e) =>
              setParams(
                e.target.value ? { with: e.target.value } : {},
                { replace: true }
              )
            }
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">choose a language…</option>
            {langsData.languages
              .filter((l) => l.key !== key && l.isPrimary)
              .map((l) => (
                <option key={l.key} value={l.key}>
                  {l.displayName} ({l.iso})
                </option>
              ))}
          </select>
        </div>
      )}

      {!otherKey && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">
            Pick a second language above to compare.
          </p>
        </div>
      )}

      {a.data && b.data && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Shared" value={shared.size} tone="accent" />
            <Stat
              label={`Only in ${a.data.displayName || a.data.name}`}
              value={onlyA.length}
              tone="a"
            />
            <Stat
              label={`Only in ${b.data.displayName || b.data.name}`}
              value={onlyB.length}
              tone="b"
            />
          </div>

          <section className="mb-10">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Consonants ({a.data.name})
            </h2>
            <HighlightedChart
              inventory={a.data}
              own={aSet}
              other={bSet}
              onSelect={play}
            />
          </section>

          <section className="mb-10">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Consonants ({b.data.name})
            </h2>
            <HighlightedChart
              inventory={b.data}
              own={bSet}
              other={aSet}
              onSelect={play}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Segments unique to each
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <SegmentBox title={`Only in ${a.data.name}`} segs={onlyA} />
              <SegmentBox title={`Only in ${b.data.name}`} segs={onlyB} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function HighlightedChart({
  inventory,
  own,
  other,
  onSelect,
}: {
  inventory: import('../schemas').Inventory;
  own: Set<string>;
  other: Set<string>;
  onSelect: (s: string) => void;
}) {
  // We overlay the full chart but dim segments not in `own`. For shared
  // segments we could render a marker in the future; v1 just highlights
  // the language's own inventory.
  void other;
  void inventory;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <IpaConsonantChart activeSegments={own} onSelect={onSelect} />
      <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <IpaVowelChart activeSegments={own} onSelect={onSelect} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'accent' | 'a' | 'b';
}) {
  const toneClass =
    tone === 'accent'
      ? 'border-accent/40 bg-accent/10 text-accent'
      : tone === 'a'
        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200'
        : 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700/50 dark:bg-sky-900/20 dark:text-sky-200';
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SegmentBox({ title, segs }: { title: string; segs: string[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title} ({segs.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {segs.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="ipa rounded bg-neutral-100 px-2 py-1 text-sm dark:bg-neutral-800"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
