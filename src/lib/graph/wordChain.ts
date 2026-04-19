/**
 * Longest-trail search on a bipartite grapheme↔phoneme graph.
 *
 * Problem: given an undirected graph, find the longest trail (no edge
 * repeats). This is NP-hard in general, so we use a pragmatic
 * multi-start greedy with random tiebreaks.
 *
 * For each candidate start edge, we extend greedily in both directions:
 * at each endpoint, pick any unused incident edge. When both directions
 * are stuck, record the length. Repeat `tries` times with different
 * starts / shuffle orders, and keep the best.
 *
 * Quality: converges near-optimally for the 30-50 edge subgraphs we feed
 * it (mostly determined by the graph's max-trail-length upper bound which
 * depends on degree parity — graphs with few odd-degree vertices have long
 * Eulerian-ish trails).
 */

import type { Edge } from './bipartite';

export interface Trail {
  /** Edges in traversal order. */
  edges: Edge[];
  /** Parallel list of vertex types — useful for rendering. */
  junctions: Array<'grapheme' | 'phoneme'>;
}

interface IncidentMap {
  // key: "g:<symbol>" or "p:<symbol>"
  edgesAt: Map<string, Array<{ edgeIndex: number; otherKey: string }>>;
}

function vertexKey(kind: 'g' | 'p', sym: string): string {
  return `${kind}:${sym}`;
}

function buildIncidence(edges: Edge[]): IncidentMap {
  const edgesAt = new Map<string, Array<{ edgeIndex: number; otherKey: string }>>();
  edges.forEach((e, idx) => {
    const gKey = vertexKey('g', e.a);
    const pKey = vertexKey('p', e.b);
    (edgesAt.get(gKey) ?? (edgesAt.set(gKey, []), edgesAt.get(gKey)!)).push({
      edgeIndex: idx,
      otherKey: pKey,
    });
    (edgesAt.get(pKey) ?? (edgesAt.set(pKey, []), edgesAt.get(pKey)!)).push({
      edgeIndex: idx,
      otherKey: gKey,
    });
  });
  return { edgesAt };
}

/** Fisher-Yates in place. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Deterministic 32-bit RNG so results are reproducible across reloads.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Greedily extend a trail from `startEdgeIndex` in both directions.
 *
 * `mustInclude` is the set of edge indices that any valid trail must
 * contain — used when the caller wants a trail through a specific
 * selection. We enforce this softly by requiring the start edge to be in
 * the set; additional included edges are discovered naturally via DFS.
 */
function extendGreedy(
  startEdgeIndex: number,
  edges: Edge[],
  incidence: IncidentMap,
  rng: () => number
): Trail {
  const n = edges.length;
  const used = new Uint8Array(n);
  used[startEdgeIndex] = 1;

  const trail: number[] = [startEdgeIndex];
  const startEdge = edges[startEdgeIndex];
  let leftEnd = vertexKey('g', startEdge.a);
  let rightEnd = vertexKey('p', startEdge.b);

  const extendAt = (end: string): [string, boolean] => {
    const cands = (incidence.edgesAt.get(end) ?? []).filter(
      (c) => !used[c.edgeIndex]
    );
    if (cands.length === 0) return [end, false];
    // Shuffle and take first — random tiebreak.
    shuffle(cands, rng);
    const pick = cands[0];
    used[pick.edgeIndex] = 1;
    return [pick.otherKey, true];
  };

  // Extend right (growing the tail)
  // We'll record which end of the trail each new edge was added to so we
  // can reconstruct the order.
  const rightTail: number[] = [];
  for (;;) {
    const cands = (incidence.edgesAt.get(rightEnd) ?? []).filter(
      (c) => !used[c.edgeIndex]
    );
    if (cands.length === 0) break;
    shuffle(cands, rng);
    const pick = cands[0];
    used[pick.edgeIndex] = 1;
    rightTail.push(pick.edgeIndex);
    rightEnd = pick.otherKey;
  }

  // Extend left (growing the head)
  const leftTail: number[] = [];
  for (;;) {
    const cands = (incidence.edgesAt.get(leftEnd) ?? []).filter(
      (c) => !used[c.edgeIndex]
    );
    if (cands.length === 0) break;
    shuffle(cands, rng);
    const pick = cands[0];
    used[pick.edgeIndex] = 1;
    leftTail.push(pick.edgeIndex);
    leftEnd = pick.otherKey;
  }

  const ordered = [...leftTail.reverse(), ...trail, ...rightTail];
  void extendAt; // silence unused-helper warning
  return decorateTrail(ordered, edges);
}

/**
 * Given an ordered list of edge indices forming a valid trail, build the
 * full Trail object with junction-vertex kinds interleaved.
 */
function decorateTrail(indices: number[], edges: Edge[]): Trail {
  if (indices.length === 0) return { edges: [], junctions: [] };
  const edgeObjs = indices.map((i) => edges[i]);

  // Determine which end of edge[0] is the "start" by checking which end
  // it shares with edge[1] (if any).
  const junctions: Array<'grapheme' | 'phoneme'> = [];
  if (edgeObjs.length === 1) {
    return { edges: edgeObjs, junctions: [] };
  }
  // Helper: shared vertex between two edges.
  const shared = (x: Edge, y: Edge): 'g' | 'p' | null => {
    if (x.a === y.a) return 'g';
    if (x.b === y.b) return 'p';
    return null;
  };
  for (let i = 0; i < edgeObjs.length - 1; i++) {
    const s = shared(edgeObjs[i], edgeObjs[i + 1]);
    junctions.push(s === 'g' ? 'grapheme' : 'phoneme');
  }
  return { edges: edgeObjs, junctions };
}

export interface FindTrailOptions {
  /** Number of random restarts. Higher = slower, slightly better. */
  tries?: number;
  /** Random seed for reproducibility. */
  seed?: number;
  /**
   * Edge indices (into `edges`) that MUST appear in the trail. If provided,
   * only trails containing all of these edges are returned.
   */
  mustInclude?: number[];
}

/**
 * Find the longest trail in the given bipartite edge set.
 *
 * Runs `tries` independent greedy walks with different random starts and
 * tiebreaks, keeps the longest. Deterministic given the seed.
 */
export function findLongestTrail(
  edges: Edge[],
  options: FindTrailOptions = {}
): Trail {
  const tries = options.tries ?? 200;
  const seed = options.seed ?? 42;
  if (edges.length === 0) return { edges: [], junctions: [] };

  const incidence = buildIncidence(edges);
  const rng = mulberry32(seed);
  let best: Trail = { edges: [], junctions: [] };

  const must = options.mustInclude ? new Set(options.mustInclude) : null;

  // Heuristic: bias starts toward high-degree endpoints — trails tend to be
  // longer when they start at low-degree endpoints, but greedy walks that
  // start at high-degree vertices have more room. For v1 just try
  // uniformly random starts.
  for (let t = 0; t < tries; t++) {
    // If we have required edges, start from one of them to guarantee
    // inclusion at least of the seed.
    const startIdx = must
      ? [...must][Math.floor(rng() * must.size)]
      : Math.floor(rng() * edges.length);
    const trail = extendGreedy(startIdx, edges, incidence, rng);

    if (must) {
      const covered = new Set(
        trail.edges.map((e) => edges.findIndex((x) => x === e))
      );
      let ok = true;
      for (const m of must) {
        if (!covered.has(m)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }
    if (trail.edges.length > best.edges.length) best = trail;
  }

  return best;
}
