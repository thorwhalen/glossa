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
import { findLongestTrail, type Trail } from '../../lib/graph/wordChain';
import { BipartiteGraph } from './BipartiteGraph';
import { WordChainStrip } from './WordChainStrip';

const ForceLayout = lazy(() =>
  import('./ForceLayout').then((m) => ({ default: m.ForceLayout }))
);

type LayoutId = 'barycenter' | 'degree' | 'alphabetic' | 'force';
type PinnedNode = { kind: 'grapheme' | 'phoneme'; symbol: string } | null;

interface Props {
  iso: string;
}

const MAX_EDGES = 200;

export function MappingGraph({ iso }: Props) {
  const { data: gp, isLoading } = useGraphemePhoneme(iso);
  const navigate = useNavigate();
  const [layoutId, setLayoutId] = useState<LayoutId>('barycenter');
  const [pinned, setPinned] = useState<PinnedNode>(null);

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

  /**
   * Chain seeded at the pinned node: the longest trail the random-restart
   * heuristic can find that touches the pinned node. Recomputes on pin
   * change; cheap enough (~50ms for 200 edges / 200 restarts) that we do it
   * synchronously in render.
   */
  const pinnedTrail = useMemo(() => {
    if (!pinned || edges.length === 0) return null;
    const seedIndices = edges
      .map((e, i) =>
        (pinned.kind === 'grapheme' && e.a === pinned.symbol) ||
        (pinned.kind === 'phoneme' && e.b === pinned.symbol)
          ? i
          : -1
      )
      .filter((i) => i >= 0);
    if (seedIndices.length === 0) return null;
    // Run a few dozen restarts per seed.
    let best: Trail = { edges: [], junctions: [] };
    for (const seed of seedIndices) {
      const trail = findLongestTrail(edges, {
        tries: 60,
        seed,
        mustInclude: [seed],
      });
      if (trail.edges.length > best.edges.length) best = trail;
    }
    return best;
  }, [edges, pinned]);

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

  const handlePin = (kind: 'grapheme' | 'phoneme', symbol: string) => {
    setPinned((cur) =>
      cur && cur.kind === kind && cur.symbol === symbol
        ? null
        : { kind, symbol }
    );
  };

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
          {pinned && (
            <span>
              Pinned: <span className="font-mono">{pinned.symbol}</span>{' '}
              <button
                type="button"
                onClick={() => setPinned(null)}
                className="text-accent hover:underline"
              >
                clear
              </button>
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
              edgeExamples={gp.edgeExamples ?? {}}
              pinned={pinned}
              onPinNode={handlePin}
              onSelectPhoneme={selectPhoneme}
            />
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-500">{LAYOUT_HINTS[layoutId]}</p>

      {pinned && pinnedTrail && pinnedTrail.edges.length > 1 && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <WordChainStrip
            title={`Word chain through ${pinned.symbol}`}
            trail={pinnedTrail}
            edgeExamples={gp.edgeExamples ?? {}}
          />
          <p className="mt-2 text-[11px] text-neutral-500">
            Each card is one word; consecutive words share either a grapheme
            (with different phoneme) or a phoneme (with different grapheme).
          </p>
        </div>
      )}

      {!pinned && (
        <p className="mt-4 text-xs text-neutral-500">
          <strong>Tip:</strong> click any node to pin it. Incident edges get
          example-word labels, and a maximal word chain through that node
          appears below.
        </p>
      )}
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
