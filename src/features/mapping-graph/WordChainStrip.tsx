import type { Trail } from '../../lib/graph/wordChain';

interface Props {
  trail: Trail;
  edgeExamples: Record<string, string[]>;
  title?: string;
  /** If set, the chain is "stale" — was computed and we show a spinner. */
  loading?: boolean;
}

/**
 * Horizontal strip of word cards that visualizes a trail through the
 * bipartite graph. Each card shows the word for the current edge and the
 * shared pivot (grapheme or phoneme) with the next edge.
 */
export function WordChainStrip({ trail, edgeExamples, title, loading }: Props) {
  if (loading) {
    return (
      <p className="text-sm text-neutral-500">Computing longest trail…</p>
    );
  }
  if (trail.edges.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No chain found — pick a node with several connections.
      </p>
    );
  }

  return (
    <div>
      {title && (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          {title}{' '}
          <span className="font-normal normal-case">
            ({trail.edges.length} words)
          </span>
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {trail.edges.map((e, i) => {
          const word = (edgeExamples[`${e.a}|${e.b}`] ?? [])[0] ?? '—';
          const pivotAhead = trail.junctions[i];
          return (
            <div
              key={`${e.a}|${e.b}|${i}`}
              className="flex shrink-0 flex-col items-center"
            >
              <div className="flex items-center gap-2">
                <div className="flex min-w-[84px] flex-col items-center rounded-md border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
                  <span className="text-sm font-medium">{word}</span>
                  <span className="mt-0.5 text-[10px] text-neutral-500">
                    <span className="font-mono">{e.a}</span>
                    <span className="mx-0.5">→</span>
                    <span className="ipa">{e.b}</span>
                  </span>
                </div>
                {pivotAhead && (
                  <span
                    className="text-[10px] text-neutral-500"
                    title={`shares ${pivotAhead}`}
                  >
                    ↔
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
