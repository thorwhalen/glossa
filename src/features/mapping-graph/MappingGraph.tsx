import { useMemo, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { useGraphemePhoneme } from '../../hooks/useData';

interface Props {
  iso: string;
}

type NodeKind = 'grapheme' | 'phoneme';
interface GNode {
  id: string;
  label: string;
  kind: NodeKind;
  weight: number;
}
interface GLink {
  source: string;
  target: string;
  value: number;
}

export function MappingGraph({ iso }: Props) {
  const { data: gp, isLoading } = useGraphemePhoneme(iso);
  const graphRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(
    undefined
  );

  const graph = useMemo(() => {
    if (!gp) return { nodes: [], links: [] };
    // Cap to top mappings to keep the layout readable.
    const topN = 200;
    const top = [...gp.mappings]
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);

    const nodeMap = new Map<string, GNode>();
    for (const m of top) {
      const gKey = `g:${m.grapheme}`;
      const pKey = `p:${m.phoneme}`;
      const gNode =
        nodeMap.get(gKey) ??
        ({
          id: gKey,
          label: m.grapheme,
          kind: 'grapheme' as const,
          weight: 0,
        } satisfies GNode);
      gNode.weight += m.count;
      nodeMap.set(gKey, gNode);

      const pNode =
        nodeMap.get(pKey) ??
        ({
          id: pKey,
          label: m.phoneme,
          kind: 'phoneme' as const,
          weight: 0,
        } satisfies GNode);
      pNode.weight += m.count;
      nodeMap.set(pKey, pNode);
    }

    const nodes = [...nodeMap.values()];
    const links: GLink[] = top.map((m) => ({
      source: `g:${m.grapheme}`,
      target: `p:${m.phoneme}`,
      value: m.count,
    }));
    return { nodes, links };
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
          The grapheme↔phoneme graph requires WikiPron data (v1 covers ~15
          languages).
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-neutral-500">
        Top 200 grapheme↔phoneme edges, weighted by observed frequency.
        Graphemes are teal; phonemes are dark. Drag nodes to explore.
      </p>
      <div className="h-[600px] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <ForceGraph2D
          ref={graphRef}
          graphData={graph}
          nodeLabel={(n) => `${n.label} (${n.weight.toLocaleString()})`}
          nodeRelSize={4}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as GNode & { x?: number; y?: number };
            const fontSize = 14 / globalScale;
            ctx.font = `${fontSize}px Inter, sans-serif`;
            const label = n.label;
            const isG = n.kind === 'grapheme';
            ctx.fillStyle = isG ? '#0d7377' : '#1f2937';
            ctx.beginPath();
            ctx.arc(
              n.x ?? 0,
              n.y ?? 0,
              Math.max(2, Math.sqrt(n.weight) / 4),
              0,
              2 * Math.PI
            );
            ctx.fill();
            ctx.fillStyle = isG ? '#0d7377' : '#374151';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              label,
              n.x ?? 0,
              (n.y ?? 0) + Math.max(6, Math.sqrt(n.weight) / 4) + fontSize
            );
          }}
          linkWidth={(l) => Math.log((l as GLink).value + 1) / 2}
          linkColor={() => 'rgba(128, 128, 128, 0.3)'}
          backgroundColor="transparent"
          cooldownTicks={100}
          onEngineStop={() => graphRef.current?.zoomToFit(400, 40)}
        />
      </div>
    </div>
  );
}
