/**
 * Bipartite layout algorithms for the grapheme ↔ phoneme mapping graph.
 *
 * Input is an edge list (grapheme, phoneme, count). Each algorithm returns
 * ordered arrays for the two layers — the renderer plots graphemes in the
 * left column and phonemes in the right column at indexed y-positions.
 *
 * Shared vocabulary used throughout:
 *   - `layerA` = graphemes (left)
 *   - `layerB` = phonemes (right)
 *   - `edges`  = [aId, bId, weight][]
 */

export interface Edge {
  a: string; // grapheme
  b: string; // phoneme
  w: number; // count / weight
}

export interface BipartiteLayout {
  layerA: string[];
  layerB: string[];
}

/**
 * Build adjacency maps + two kinds of "degree" for each node:
 *   degreeA[g]    = number of distinct phonemes g maps to (fan-out)
 *   weightA[g]    = sum of edge weights (total observations) for g
 *
 * Degree and weight can diverge: a grapheme mapping to one phoneme 1000× has
 * weight 1000 but degree 1, while a grapheme mapping to 5 phonemes 10× each
 * has weight 50 but degree 5. The UI sorts by *degree* by default because
 * that matches the intuitive "how many distinct edges go out of this node".
 */
function buildAdjacency(edges: Edge[]) {
  const adjA = new Map<string, string[]>();
  const adjB = new Map<string, string[]>();
  const weightA = new Map<string, number>();
  const weightB = new Map<string, number>();
  const degreeA = new Map<string, number>();
  const degreeB = new Map<string, number>();
  for (const { a, b, w } of edges) {
    (adjA.get(a) ?? (adjA.set(a, []), adjA.get(a)!)).push(b);
    (adjB.get(b) ?? (adjB.set(b, []), adjB.get(b)!)).push(a);
    weightA.set(a, (weightA.get(a) ?? 0) + w);
    weightB.set(b, (weightB.get(b) ?? 0) + w);
    degreeA.set(a, (degreeA.get(a) ?? 0) + 1);
    degreeB.set(b, (degreeB.get(b) ?? 0) + 1);
  }
  return { adjA, adjB, weightA, weightB, degreeA, degreeB };
}

function uniqueNodes(edges: Edge[]): { a: string[]; b: string[] } {
  const a = new Set<string>();
  const b = new Set<string>();
  for (const e of edges) {
    a.add(e.a);
    b.add(e.b);
  }
  return { a: [...a], b: [...b] };
}

/**
 * Alphabetical ordering — phonemes sorted by Unicode codepoint, which is
 * meaningless to IPA but at least deterministic and browsable.
 */
export function layoutAlphabetic(edges: Edge[]): BipartiteLayout {
  const { a, b } = uniqueNodes(edges);
  return {
    layerA: [...a].sort(),
    layerB: [...b].sort(),
  };
}

export type DegreeDriver = 'grapheme' | 'phoneme';
export type SortDirection = 'desc' | 'asc';

/**
 * Sort the "driver" side by its total edge weight (ascending or descending).
 * Order the other side via a single barycenter sweep so edges stay as
 * straight as possible given the fixed driver order.
 *
 * Four concrete combinations:
 *   driver='grapheme', direction='desc'  — graphemes ranked by fan-out,
 *     most-connected at top; phonemes follow to minimize crossings
 *   driver='grapheme', direction='asc'   — least-connected graphemes first
 *   driver='phoneme', direction='desc'   — phoneme hubs on top
 *   driver='phoneme', direction='asc'    — rarest phonemes on top
 */
export function layoutByDegree(
  edges: Edge[],
  opts: { driver?: DegreeDriver; direction?: SortDirection } = {}
): BipartiteLayout {
  const driver = opts.driver ?? 'grapheme';
  const direction = opts.direction ?? 'desc';
  const { a, b } = uniqueNodes(edges);
  const { adjA, adjB, degreeA, degreeB } = buildAdjacency(edges);

  const driverNodes = driver === 'grapheme' ? a : b;
  const otherNodes = driver === 'grapheme' ? b : a;
  const driverDeg = driver === 'grapheme' ? degreeA : degreeB;
  const driverAdj = driver === 'grapheme' ? adjA : adjB;
  const otherAdj = driver === 'grapheme' ? adjB : adjA;

  const degCmp = (x: string, y: string) => {
    const dx = driverDeg.get(x) ?? 0;
    const dy = driverDeg.get(y) ?? 0;
    return direction === 'desc' ? dy - dx : dx - dy;
  };

  /**
   * Constrained barycenter: the driver side is strictly ranked by degree
   * (which is what the user picked). Within each degree-group, we are free
   * to reorder — and we do, using barycenter, so ties resolve toward fewer
   * edge crossings. The non-driver side is ordered purely by barycenter.
   *
   * Iterate until neither ordering changes, or give up after MAX_ITERS.
   */
  const MAX_ITERS = 20;
  let sortedDriver = [...driverNodes].sort(
    (x, y) => degCmp(x, y) || x.localeCompare(y)
  );
  let sortedOther = [...otherNodes];

  const makePos = (arr: string[]) => {
    const m = new Map<string, number>();
    arr.forEach((x, i) => m.set(x, i));
    return m;
  };

  const barycenter = (
    node: string,
    adj: Map<string, string[]>,
    pos: Map<string, number>
  ): number => {
    const neighbors = adj.get(node) ?? [];
    if (neighbors.length === 0) return Number.POSITIVE_INFINITY;
    let sum = 0;
    let n = 0;
    for (const nb of neighbors) {
      const p = pos.get(nb);
      if (p !== undefined) {
        sum += p;
        n++;
      }
    }
    return n > 0 ? sum / n : Number.POSITIVE_INFINITY;
  };

  for (let i = 0; i < MAX_ITERS; i++) {
    // Re-order the non-driver side purely by barycenter relative to driver.
    const driverPos = makePos(sortedDriver);
    const nextOther = [...sortedOther].sort((x, y) => {
      const bx = barycenter(x, otherAdj, driverPos);
      const by = barycenter(y, otherAdj, driverPos);
      return bx - by || x.localeCompare(y);
    });

    // Re-order the driver: primary key = degree-direction (unchanged across
    // iterations), secondary = barycenter toward the just-updated other side.
    const otherPos = makePos(nextOther);
    const nextDriver = [...sortedDriver].sort((x, y) => {
      const cmp = degCmp(x, y);
      if (cmp !== 0) return cmp;
      const bx = barycenter(x, driverAdj, otherPos);
      const by = barycenter(y, driverAdj, otherPos);
      return bx - by || x.localeCompare(y);
    });

    const stable =
      nextDriver.every((v, j) => v === sortedDriver[j]) &&
      nextOther.every((v, j) => v === sortedOther[j]);
    sortedDriver = nextDriver;
    sortedOther = nextOther;
    if (stable) break;
  }

  return driver === 'grapheme'
    ? { layerA: sortedDriver, layerB: sortedOther }
    : { layerA: sortedOther, layerB: sortedDriver };
}

/**
 * Barycenter heuristic for bipartite crossing minimization.
 *
 * Reference: Sugiyama, Tagawa, Toda (1981). This is the workhorse method for
 * layered graph drawing. We iterate:
 *
 *   for each node in layer B: barycenter = mean position of its neighbors in A
 *   sort layer B by barycenter
 *   swap sides, repeat
 *
 * Converges quickly (≤20 sweeps) to a local optimum. Not optimal in general
 * — the crossing-minimization problem is NP-hard — but in practice produces
 * dramatically cleaner layouts than random or alphabetic ordering.
 */
export function layoutByBarycenter(
  edges: Edge[],
  options: { iterations?: number } = {}
): BipartiteLayout {
  const iterations = options.iterations ?? 20;
  const { adjA, adjB } = buildAdjacency(edges);

  // Seed with degree-sorted order — better starting point than alphabetic.
  let { layerA, layerB } = layoutByDegree(edges);

  const barycenter = (
    neighbors: string[] | undefined,
    pos: Map<string, number>
  ): number => {
    if (!neighbors || neighbors.length === 0) return Number.POSITIVE_INFINITY;
    let sum = 0;
    let n = 0;
    for (const nb of neighbors) {
      const p = pos.get(nb);
      if (p !== undefined) {
        sum += p;
        n++;
      }
    }
    return n > 0 ? sum / n : Number.POSITIVE_INFINITY;
  };

  const makePos = (arr: string[]): Map<string, number> => {
    const m = new Map<string, number>();
    arr.forEach((x, i) => m.set(x, i));
    return m;
  };

  for (let i = 0; i < iterations; i++) {
    // Reorder B based on A's current positions
    const aPos = makePos(layerA);
    const bWithBary = layerB.map((n) => ({
      n,
      bary: barycenter(adjB.get(n), aPos),
    }));
    bWithBary.sort((x, y) => x.bary - y.bary || x.n.localeCompare(y.n));
    layerB = bWithBary.map((x) => x.n);

    // Reorder A based on B's current positions
    const bPos = makePos(layerB);
    const aWithBary = layerA.map((n) => ({
      n,
      bary: barycenter(adjA.get(n), bPos),
    }));
    aWithBary.sort((x, y) => x.bary - y.bary || x.n.localeCompare(y.n));
    layerA = aWithBary.map((x) => x.n);
  }

  return { layerA, layerB };
}

/**
 * Total number of edge crossings for a given ordering. O(|E|^2) — fine for
 * our edge counts (≤200). Useful for a debug readout and for unit tests.
 */
export function countCrossings(edges: Edge[], layout: BipartiteLayout): number {
  const posA = new Map(layout.layerA.map((n, i) => [n, i]));
  const posB = new Map(layout.layerB.map((n, i) => [n, i]));
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    const e1 = edges[i];
    const a1 = posA.get(e1.a);
    const b1 = posB.get(e1.b);
    if (a1 === undefined || b1 === undefined) continue;
    for (let j = i + 1; j < edges.length; j++) {
      const e2 = edges[j];
      const a2 = posA.get(e2.a);
      const b2 = posB.get(e2.b);
      if (a2 === undefined || b2 === undefined) continue;
      if ((a1 - a2) * (b1 - b2) < 0) crossings++;
    }
  }
  return crossings;
}
