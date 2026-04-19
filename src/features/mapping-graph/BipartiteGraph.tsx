import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { BipartiteLayout, Edge } from '../../lib/graph/bipartite';

interface Props {
  edges: Edge[];
  layout: BipartiteLayout;
  /** edgeKey "{g}|{p}" → example words (longest first). */
  edgeExamples: Record<string, string[]>;
  onSelectPhoneme: (p: string) => void;
  /** Called when a node is clicked so the parent can offer follow-up actions. */
  onPinNode?: (kind: 'grapheme' | 'phoneme', symbol: string) => void;
  /** Which node, if any, is currently pinned (sticky highlight). */
  pinned?: { kind: 'grapheme' | 'phoneme'; symbol: string } | null;
}

const NODE_RADIUS = 11;
const NODE_GAP = 26;
const PAD_TOP = 28;
const PAD_BOTTOM = 28;
const COL_LEFT = 120;
const COL_RIGHT = 640;
const LABEL_OFFSET = 18;

/**
 * Static SVG renderer. Graphemes in a left column, phonemes in the right;
 * ordering is driven by `layout`. Edges become straight lines between
 * aligned rows.
 *
 * Interactivity:
 *   - Hover a node: its incident edges stay full-opacity, others dim, and
 *     each incident edge shows an example word label.
 *   - Click a node: the hover state sticks as "pinned" so the user can scroll
 *     without losing the selection; click again to unpin.
 */
export function BipartiteGraph({
  edges,
  layout,
  edgeExamples,
  onSelectPhoneme,
  onPinNode,
  pinned,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const activeKey =
    hovered ??
    (pinned ? nodeKey(pinned.kind === 'grapheme' ? 'g' : 'p', pinned.symbol) : null);

  const { layerA, layerB } = layout;
  const posA = useMemo(() => indexPositions(layerA), [layerA]);
  const posB = useMemo(() => indexPositions(layerB), [layerB]);

  const height =
    PAD_TOP + Math.max(layerA.length, layerB.length) * NODE_GAP + PAD_BOTTOM;
  const width = COL_RIGHT + 140;
  const maxW = useMemo(() => Math.max(1, ...edges.map((e) => e.w)), [edges]);

  // For each edge, is it "active" (incident to the active node)?
  const isEdgeActive = (e: Edge): boolean => {
    if (!activeKey) return false;
    return activeKey === nodeKey('g', e.a) || activeKey === nodeKey('p', e.b);
  };

  return (
    <div className="overflow-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="text-neutral-600 dark:text-neutral-300"
        style={{ minWidth: 780, height }}
        role="img"
        aria-label="Bipartite grapheme-phoneme graph"
      >
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
            const active = isEdgeActive(e);
            const faded = activeKey !== null && !active;
            const strokeWidth =
              0.5 + (Math.log(e.w + 1) / Math.log(maxW + 1)) * 2.5;
            return (
              <motion.line
                key={`${e.a}→${e.b}`}
                initial={false}
                animate={{
                  x1: COL_LEFT + NODE_RADIUS,
                  y1,
                  x2: COL_RIGHT - NODE_RADIUS,
                  y2,
                }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
                stroke={active ? '#0d7377' : 'currentColor'}
                strokeOpacity={faded ? 0.05 : active ? 0.8 : 0.25}
                strokeWidth={active ? strokeWidth + 0.5 : strokeWidth}
              />
            );
          })}
        </g>

        {/* Edge labels (only drawn for active edges) */}
        {activeKey &&
          edges.map((e) => {
            if (!isEdgeActive(e)) return null;
            const ay = posA.get(e.a);
            const by = posB.get(e.b);
            if (ay === undefined || by === undefined) return null;
            const examples = edgeExamples[`${e.a}|${e.b}`] ?? [];
            if (examples.length === 0) return null;
            const mx = (COL_LEFT + COL_RIGHT) / 2;
            const my = PAD_TOP + (ay + by) * NODE_GAP * 0.5;
            return (
              <g key={`lbl-${e.a}→${e.b}`} style={{ pointerEvents: 'none' }}>
                <rect
                  x={mx - 22}
                  y={my - 9}
                  width={44}
                  height={16}
                  rx={3}
                  className="fill-white stroke-accent/40 dark:fill-neutral-900"
                  strokeWidth={0.5}
                />
                <text
                  x={mx}
                  y={my + 3}
                  textAnchor="middle"
                  className="fill-accent text-[10px] font-medium"
                >
                  {examples[0]}
                </text>
              </g>
            );
          })}

        {/* Layer A (graphemes) */}
        {layerA.map((g, i) => {
          const y = PAD_TOP + i * NODE_GAP;
          const key = nodeKey('g', g);
          const isHot = activeKey === key ||
            (activeKey !== null &&
              edges.some(
                (e) => e.a === g && activeKey === nodeKey('p', e.b)
              ));
          const isPinned = pinned?.kind === 'grapheme' && pinned.symbol === g;
          return (
            <motion.g
              key={`g-${g}`}
              initial={false}
              animate={{ y }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onPinNode?.('grapheme', g)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={COL_LEFT}
                cy={0}
                r={NODE_RADIUS}
                className={
                  isPinned
                    ? 'fill-accent stroke-accent'
                    : isHot
                      ? 'fill-accent/20 stroke-accent'
                      : 'fill-white stroke-neutral-300 dark:fill-neutral-950 dark:stroke-neutral-700'
                }
                strokeWidth={isPinned ? 2 : 1}
              />
              <text
                x={COL_LEFT - LABEL_OFFSET}
                y={4}
                textAnchor="end"
                className={
                  isPinned
                    ? 'fill-accent font-mono text-[13px] font-medium'
                    : 'fill-neutral-700 font-mono text-[13px] dark:fill-neutral-300'
                }
              >
                {g}
              </text>
            </motion.g>
          );
        })}

        {/* Layer B (phonemes) */}
        {layerB.map((p, i) => {
          const y = PAD_TOP + i * NODE_GAP;
          const key = nodeKey('p', p);
          const isHot = activeKey === key ||
            (activeKey !== null &&
              edges.some(
                (e) => e.b === p && activeKey === nodeKey('g', e.a)
              ));
          const isPinned = pinned?.kind === 'phoneme' && pinned.symbol === p;
          return (
            <motion.g
              key={`p-${p}`}
              initial={false}
              animate={{ y }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (e.detail === 2) {
                  // double-click opens detail
                  onSelectPhoneme(p);
                } else {
                  onPinNode?.('phoneme', p);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={COL_RIGHT}
                cy={0}
                r={NODE_RADIUS}
                className={
                  isPinned
                    ? 'fill-accent stroke-accent'
                    : isHot
                      ? 'fill-accent/20 stroke-accent'
                      : 'fill-accent/5 stroke-accent/40'
                }
                strokeWidth={isPinned ? 2 : 1}
              />
              <text
                x={COL_RIGHT + LABEL_OFFSET}
                y={4}
                textAnchor="start"
                className={
                  isPinned
                    ? 'ipa fill-accent text-[14px] font-medium'
                    : 'ipa fill-neutral-700 text-[14px] dark:fill-neutral-300'
                }
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

function nodeKey(kind: 'g' | 'p', sym: string): string {
  return `${kind}:${sym}`;
}

function indexPositions(arr: string[]): Map<string, number> {
  const m = new Map<string, number>();
  arr.forEach((x, i) => m.set(x, i));
  return m;
}
