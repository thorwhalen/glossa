import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGraphemePhoneme } from '../../hooks/useData';
import {
  countCrossings,
  layoutAlphabetic,
  layoutByBarycenter,
  layoutByDegree,
  type Edge,
} from '../../lib/graph/bipartite';
import { BipartiteGraph } from './BipartiteGraph';

// react-force-graph-2d is ~190 kB — only pull it in when the user picks the
// force layout.
const ForceLayout = lazy(() =>
  import('./ForceLayout').then((m) => ({ default: m.ForceLayout }))
);

type LayoutId = 'barycenter' | 'degree' | 'alphabetic' | 'force';

interface Props {
  iso: string;
}

const MAX_EDGES = 200;

export function MappingGraph({ iso }: Props) {
  const { data: gp, isLoading } = useGraphemePhoneme(iso);
  const navigate = useNavigate();
  const [layoutId, setLayoutId] = useState<LayoutId>('barycenter');

  const edges: Edge[] = useMemo(() => {
    if (!gp) return [];
    return [...gp.mappings]
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_EDGES)
      .map((m) => ({ a: m.grapheme, b: m.phoneme, w: m.count }));
  }, [gp]);

  const bipartiteLayout = useMemo(() => {
    if (edges.length === 0) return { layerA: [], layerB: [] };
    switch (layoutId) {
      case 'barycenter':
        return layoutByBarycenter(edges);
      case 'degree':
        return layoutByDegree(edges);
      case 'alphabetic':
        return layoutAlphabetic(edges);
      default:
        return layoutByBarycenter(edges);
    }
  }, [edges, layoutId]);

  const crossings = useMemo(() => {
    if (layoutId === 'force' || edges.length === 0) return null;
    return countCrossings(edges, bipartiteLayout);
  }, [edges, bipartiteLayout, layoutId]);

  if (isLoading) return <p className="text-neutral-500">Loading lexicon…</p>;

  if (!gp) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-500">
          No lexicon available for this language yet.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          The grapheme↔phoneme graph requires WikiPron data (v1 covers ~15
          languages).
        </p>
      </div>
    );
  }

  const selectPhoneme = (p: string) =>
    navigate(`/lang/${iso}/phoneme/${encodeURIComponent(p)}`);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <LayoutPicker value={layoutId} onChange={setLayoutId} />
        <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span>
            Top {edges.length} edges · {bipartiteLayout.layerA.length} graphemes ·{' '}
            {bipartiteLayout.layerB.length} phonemes
          </span>
          {crossings !== null && (
            <span className="tabular-nums">
              {crossings.toLocaleString()} crossings
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        {layoutId === 'force' ? (
          <Suspense
            fallback={
              <div className="flex h-[600px] items-center justify-center text-neutral-500">
                Loading force layout…
              </div>
            }
          >
            <ForceLayout edges={edges} onSelectPhoneme={selectPhoneme} />
          </Suspense>
        ) : (
          <div className="p-4">
            <BipartiteGraph
              edges={edges}
              layout={bipartiteLayout}
              onSelectPhoneme={selectPhoneme}
            />
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {LAYOUT_HINTS[layoutId]}
      </p>
    </div>
  );
}

const LAYOUT_HINTS: Record<LayoutId, string> = {
  barycenter:
    'Barycenter heuristic (Sugiyama). Orders each side so the average edge goes straight-across — minimizes visual crossings.',
  degree:
    'Sort each side by total edge weight. Highly-connected hubs rise to the top; tails of rare mappings fall to the bottom.',
  alphabetic:
    'Deterministic but structure-blind. Useful as a reference baseline when comparing languages.',
  force:
    'Physics-based clusters. Connected nodes pull together; unrelated ones repel. Good for seeing communities; worse for reading specific edges.',
};

function LayoutPicker({
  value,
  onChange,
}: {
  value: LayoutId;
  onChange: (v: LayoutId) => void;
}) {
  const options: Array<{ id: LayoutId; label: string }> = [
    { id: 'barycenter', label: 'Min crossings' },
    { id: 'degree', label: 'By degree' },
    { id: 'alphabetic', label: 'Alphabetic' },
    { id: 'force', label: 'Force' },
  ];
  return (
    <div
      role="tablist"
      aria-label="graph layout"
      className="inline-flex overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700"
    >
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={[
            'px-3 py-1.5 text-xs transition',
            value === o.id
              ? 'bg-accent text-white'
              : 'bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
