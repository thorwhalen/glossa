import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGraphemePhoneme } from '../../hooks/useData';
import {
  countCrossings,
  layoutAlphabetic,
  layoutByBarycenter,
  layoutByDegree,
  type Edge,
  type SortDirection,
} from '../../lib/graph/bipartite';
import { findLongestTrail, type Trail } from '../../lib/graph/wordChain';
import { BipartiteGraph } from './BipartiteGraph';
import { WordChainStrip } from './WordChainStrip';

const ForceLayout = lazy(() =>
  import('./ForceLayout').then((m) => ({ default: m.ForceLayout }))
);

type LayoutId =
  | 'barycenter'
  | 'degree-grapheme'
  | 'degree-phoneme'
  | 'alphabetic'
  | 'force';
type PinnedNode = { kind: 'grapheme' | 'phoneme'; symbol: string } | null;

interface Props {
  iso: string;
}

const MAX_EDGES = 200;

export function MappingGraph({ iso }: Props) {
  const { data: gp, isLoading } = useGraphemePhoneme(iso);
  const navigate = useNavigate();
  const [layoutId, setLayoutId] = useState<LayoutId>('barycenter');
  // Per-driver sort direction — remembered across layout switches, so
  // toggling "Graphemes" away and back preserves its chosen arrow.
  const [grapDir, setGrapDir] = useState<SortDirection>('desc');
  const [phonDir, setPhonDir] = useState<SortDirection>('desc');
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
      case 'degree-grapheme':
        return layoutByDegree(edges, {
          driver: 'grapheme',
          direction: grapDir,
        });
      case 'degree-phoneme':
        return layoutByDegree(edges, {
          driver: 'phoneme',
          direction: phonDir,
        });
      case 'alphabetic':
        return layoutAlphabetic(edges);
      default:
        return layoutByBarycenter(edges);
    }
  }, [edges, layoutId, grapDir, phonDir]);

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

  // Lexicon present but the aligner couldn't produce meaningful pairs.
  // This is the common failure mode for syllabaries / abugidas (Korean
  // Hangul, Japanese kana, Devanagari) where word length and IPA segment
  // count rarely match 1:1.
  if (edges.length < 5) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-500">
          Not enough grapheme↔phoneme data to draw a meaningful graph for
          this language.
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          The v1 aligner zips word characters with IPA segments 1-to-1, which
          works poorly for syllabaries and abugidas. A smarter aligner (or a
          language-specific G2P tool like Epitran) would be needed.
        </p>
        {gp.mappings.length > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            We observed {gp.mappings.length} alignment pair
            {gp.mappings.length === 1 ? '' : 's'} in the lexicon.
          </p>
        )}
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
        <LayoutPicker
          value={layoutId}
          grapDir={grapDir}
          phonDir={phonDir}
          onPick={(id) => {
            // Clicking a degree button while already active flips its arrow.
            if (id === 'degree-grapheme' && layoutId === 'degree-grapheme') {
              setGrapDir(grapDir === 'desc' ? 'asc' : 'desc');
              return;
            }
            if (id === 'degree-phoneme' && layoutId === 'degree-phoneme') {
              setPhonDir(phonDir === 'desc' ? 'asc' : 'desc');
              return;
            }
            setLayoutId(id);
          }}
        />
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
  'degree-grapheme':
    'Graphemes ranked by number of distinct edges (fan-out). Ties among equal-fan-out graphemes are resolved by barycenter, so crossings are minimized within each tier.',
  'degree-phoneme':
    'Phonemes ranked by number of distinct edges (fan-in). Ties among equal-fan-in phonemes are resolved by barycenter, so crossings are minimized within each tier.',
  alphabetic:
    'Deterministic but structure-blind. Useful as a reference baseline when comparing languages.',
  force:
    'Physics-based clusters. Connected nodes pull together; unrelated ones repel. Good for seeing communities; worse for reading specific edges.',
};

function LayoutPicker({
  value,
  grapDir,
  phonDir,
  onPick,
}: {
  value: LayoutId;
  grapDir: SortDirection;
  phonDir: SortDirection;
  onPick: (id: LayoutId) => void;
}) {
  const arrow = (dir: SortDirection) => (dir === 'desc' ? '↓' : '↑');
  const options: Array<{ id: LayoutId; label: string }> = [
    { id: 'barycenter', label: 'Min crossings' },
    {
      id: 'degree-grapheme',
      label: `Graphemes ${arrow(grapDir)}`,
    },
    {
      id: 'degree-phoneme',
      label: `Phonemes ${arrow(phonDir)}`,
    },
    { id: 'alphabetic', label: 'Alphabetic' },
    { id: 'force', label: 'Force' },
  ];
  return (
    <div
      role="tablist"
      aria-label="graph layout"
      className="inline-flex overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-700"
    >
      {options.map((o) => {
        const active = value === o.id;
        const isDegree =
          o.id === 'degree-grapheme' || o.id === 'degree-phoneme';
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onPick(o.id)}
            title={
              active && isDegree ? 'click again to reverse direction' : undefined
            }
            className={[
              'px-3 py-1.5 text-xs transition',
              active
                ? 'bg-accent text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
