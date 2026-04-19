import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { BipartiteLayout, Edge } from '../../lib/graph/bipartite';

interface Props {
  edges: Edge[];
  layout: BipartiteLayout;
  onSelectPhoneme: (p: string) => void;
}

/**
 * Static SVG renderer for bipartite layouts. Graphemes are stacked in the
 * left column, phonemes in the right. Each node is keyed on its symbol so
 * framer-motion animates the y-position when the layout changes.
 */
const NODE_RADIUS = 11;
const NODE_GAP = 26;
const PAD_TOP = 28;
const PAD_BOTTOM = 28;
const COL_LEFT = 120;
const COL_RIGHT = 640;
const LABEL_OFFSET = 18;

export function BipartiteGraph({ edges, layout, onSelectPhoneme }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { layerA, layerB } = layout;
  const posA = useMemo(() => indexPositions(layerA), [layerA]);
  const posB = useMemo(() => indexPositions(layerB), [layerB]);

  const height =
    PAD_TOP +
    Math.max(layerA.length, layerB.length) * NODE_GAP +
    PAD_BOTTOM;
  const width = COL_RIGHT + 120;

  const maxW = useMemo(
    () => Math.max(1, ...edges.map((e) => e.w)),
    [edges]
  );

  return (
    <div className="overflow-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="text-neutral-600 dark:text-neutral-300"
        style={{ minWidth: 720, height }}
        role="img"
        aria-label="Bipartite grapheme-phoneme graph"
      >
        {/* Column headers */}
        <text
          x={COL_LEFT}
          y={14}
          textAnchor="middle"
          className="fill-neutral-500 text-[11px] font-medium uppercase tracking-wide"
        >
          Graphemes
        </text>
        <text
          x={COL_RIGHT}
          y={14}
          textAnchor="middle"
          className="fill-neutral-500 text-[11px] font-medium uppercase tracking-wide"
        >
          Phonemes
        </text>

        {/* Edges */}
        <g>
          {edges.map((e) => {
            const ay = posA.get(e.a);
            const by = posB.get(e.b);
            if (ay === undefined || by === undefined) return null;
            const y1 = PAD_TOP + ay * NODE_GAP;
            const y2 = PAD_TOP + by * NODE_GAP;
            const faded =
              hovered !== null && hovered !== e.a && hovered !== e.b;
            const strokeWidth = 0.5 + (Math.log(e.w + 1) / Math.log(maxW + 1)) * 2.5;
            return (
              <motion.line
                key={`${e.a}→${e.b}`}
                initial={false}
                animate={{ x1: COL_LEFT + NODE_RADIUS, y1, x2: COL_RIGHT - NODE_RADIUS, y2 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                stroke="currentColor"
                strokeOpacity={faded ? 0.05 : 0.25}
                strokeWidth={strokeWidth}
              />
            );
          })}
        </g>

        {/* Layer A (graphemes) */}
        {layerA.map((g, i) => {
          const y = PAD_TOP + i * NODE_GAP;
          const isHot =
            hovered === g ||
            (hovered !== null &&
              edges.some((e) => e.a === g && e.b === hovered));
          return (
            <motion.g
              key={`g-${g}`}
              initial={false}
              animate={{ y }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              onMouseEnter={() => setHovered(g)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={COL_LEFT}
                cy={0}
                r={NODE_RADIUS}
                className={
                  isHot
                    ? 'fill-accent/20 stroke-accent'
                    : 'fill-white stroke-neutral-300 dark:fill-neutral-950 dark:stroke-neutral-700'
                }
                strokeWidth={1}
              />
              <text
                x={COL_LEFT - LABEL_OFFSET}
                y={4}
                textAnchor="end"
                className="fill-neutral-700 font-mono text-[13px] dark:fill-neutral-300"
              >
                {g}
              </text>
            </motion.g>
          );
        })}

        {/* Layer B (phonemes) */}
        {layerB.map((p, i) => {
          const y = PAD_TOP + i * NODE_GAP;
          const isHot =
            hovered === p ||
            (hovered !== null &&
              edges.some((e) => e.b === p && e.a === hovered));
          return (
            <motion.g
              key={`p-${p}`}
              initial={false}
              animate={{ y }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelectPhoneme(p)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={COL_RIGHT}
                cy={0}
                r={NODE_RADIUS}
                className={
                  isHot
                    ? 'fill-accent/20 stroke-accent'
                    : 'fill-accent/5 stroke-accent/40'
                }
                strokeWidth={1}
              />
              <text
                x={COL_RIGHT + LABEL_OFFSET}
                y={4}
                textAnchor="start"
                className="ipa fill-neutral-700 text-[14px] dark:fill-neutral-300"
              >
                {p}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

function indexPositions(arr: string[]): Map<string, number> {
  const m = new Map<string, number>();
  arr.forEach((x, i) => m.set(x, i));
  return m;
}
