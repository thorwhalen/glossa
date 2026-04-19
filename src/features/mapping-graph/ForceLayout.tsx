import { useMemo, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import type { Edge } from '../../lib/graph/bipartite';

interface Props {
  edges: Edge[];
  onSelectPhoneme: (p: string) => void;
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

/**
 * Force-directed layout. Nodes pull together by edges, push apart by charge.
 * Good for seeing community structure; less good for reading individual
 * edges. Labels are rendered via nodeCanvasObject because the library doesn't
 * support styled labels natively.
 */
export function ForceLayout({ edges, onSelectPhoneme }: Props) {
  const graphRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(
    undefined
  );

  const graph = useMemo(() => {
    const nodeMap = new Map<string, GNode>();
    for (const e of edges) {
      const gKey = `g:${e.a}`;
      const pKey = `p:${e.b}`;
      const gNode =
        nodeMap.get(gKey) ??
        ({
          id: gKey,
          label: e.a,
          kind: 'grapheme' as const,
          weight: 0,
        } satisfies GNode);
      gNode.weight += e.w;
      nodeMap.set(gKey, gNode);

      const pNode =
        nodeMap.get(pKey) ??
        ({
          id: pKey,
          label: e.b,
          kind: 'phoneme' as const,
          weight: 0,
        } satisfies GNode);
      pNode.weight += e.w;
      nodeMap.set(pKey, pNode);
    }
    const nodes = [...nodeMap.values()];
    const links: GLink[] = edges.map((e) => ({
      source: `g:${e.a}`,
      target: `p:${e.b}`,
      value: e.w,
    }));
    return { nodes, links };
  }, [edges]);

  return (
    <div className="h-[600px]">
      <ForceGraph2D
        ref={graphRef}
        graphData={graph}
        nodeLabel={(n) => `${n.label} (${n.weight.toLocaleString()})`}
        nodeRelSize={4}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as GNode & { x?: number; y?: number };
          const fontSize = 14 / globalScale;
          ctx.font = `${fontSize}px Inter, sans-serif`;
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
            n.label,
            n.x ?? 0,
            (n.y ?? 0) + Math.max(6, Math.sqrt(n.weight) / 4) + fontSize
          );
        }}
        linkWidth={(l) => Math.log((l as GLink).value + 1) / 2}
        linkColor={() => 'rgba(128, 128, 128, 0.3)'}
        backgroundColor="transparent"
        cooldownTicks={100}
        onNodeClick={(node) => {
          const n = node as GNode;
          if (n.kind === 'phoneme') onSelectPhoneme(n.label);
        }}
        onEngineStop={() => graphRef.current?.zoomToFit(400, 40)}
      />
    </div>
  );
}
