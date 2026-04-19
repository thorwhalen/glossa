import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type {
  GraphemePhoneme,
  Inventory,
  LanguageSummary,
  PhonemeIndex,
} from '../../schemas';
import {
  findLongestTrail,
  type Trail,
} from '../../lib/graph/wordChain';
import { WordChainStrip } from '../mapping-graph/WordChainStrip';

interface Props {
  inventory: Inventory;
  summary?: LanguageSummary;
  gp?: GraphemePhoneme | null;
  phonemeIndex?: PhonemeIndex | null;
  /**
   * Median phoneme count across all languages — used for the "above/below
   * average" fact. Caller passes it because we only have the summary index.
   */
  medianPhonemeCount?: number;
}

/**
 * A handful of generated observations about a language's inventory and
 * grapheme↔phoneme patterns. Designed to be a pleasant scroll-down at the
 * bottom of the Chart tab — each fact is a single sentence or two, with a
 * small number or word-chain as the visual punch.
 *
 * Facts that depend on WikiPron alignments are gated on `gp` being present.
 * Facts from PHOIBLE alone always render when the inventory is non-empty.
 */
export function FunFacts({
  inventory,
  gp,
  phonemeIndex,
  medianPhonemeCount,
}: Props) {
  const phonemeFacts = useMemo(
    () => buildPhonemeFacts(inventory, phonemeIndex, medianPhonemeCount),
    [inventory, phonemeIndex, medianPhonemeCount]
  );

  const graphemeFacts = useMemo(
    () => (gp ? buildGraphemeFacts(gp) : []),
    [gp]
  );

  const maxChain = useMemo<{ trail: Trail; seedLabel?: string } | null>(() => {
    if (!gp) return null;
    const edges = [...gp.mappings]
      .sort((a, b) => b.count - a.count)
      .slice(0, 60)
      .map((m) => ({ a: m.grapheme, b: m.phoneme, w: m.count }));
    if (edges.length < 3) return null;
    const trail = findLongestTrail(edges, { tries: 300, seed: 17 });
    return { trail };
  }, [gp]);

  const hasAnything =
    phonemeFacts.length > 0 || graphemeFacts.length > 0 || maxChain !== null;
  if (!hasAnything) return null;

  return (
    <section className="mt-12 border-t border-neutral-200 pt-8 dark:border-neutral-800">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
        <Sparkles size={14} />
        Fun facts about {inventory.name}
      </h2>

      <ul className="space-y-4">
        {phonemeFacts.map((f, i) => (
          <Fact key={`p-${i}`} {...f} />
        ))}
        {graphemeFacts.map((f, i) => (
          <Fact key={`g-${i}`} {...f} />
        ))}
      </ul>

      {maxChain && maxChain.trail.edges.length >= 3 && gp && (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="mb-2 text-sm">
            The longest word chain we could build on the top 60
            grapheme↔phoneme edges has{' '}
            <strong className="tabular-nums">
              {maxChain.trail.edges.length}
            </strong>{' '}
            words. Each consecutive pair shares either a grapheme (with
            different phoneme) or a phoneme (with different grapheme).
          </p>
          <WordChainStrip
            trail={maxChain.trail}
            edgeExamples={gp.edgeExamples ?? {}}
          />
        </div>
      )}
    </section>
  );
}

interface FactProps {
  title: string;
  body: React.ReactNode;
}

function Fact({ title, body }: FactProps) {
  return (
    <li className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{body}</p>
    </li>
  );
}

function buildPhonemeFacts(
  inventory: Inventory,
  phonemeIndex?: PhonemeIndex | null,
  medianPhonemeCount?: number
): FactProps[] {
  const facts: FactProps[] = [];
  const count = inventory.phonemes.length;

  if (medianPhonemeCount !== undefined) {
    const delta = count - medianPhonemeCount;
    const percent = Math.abs(Math.round((delta / medianPhonemeCount) * 100));
    facts.push({
      title: 'Inventory size',
      body: (
        <>
          <strong>{count}</strong> phonemes —{' '}
          {delta === 0
            ? 'exactly the world median.'
            : delta > 0
              ? `${percent}% above the world median (${medianPhonemeCount}).`
              : `${percent}% below the world median (${medianPhonemeCount}).`}
        </>
      ),
    });
  } else {
    facts.push({
      title: 'Inventory size',
      body: (
        <>
          <strong>{count}</strong> phonemes in the inventory.
        </>
      ),
    });
  }

  if (phonemeIndex) {
    // Find inventory phonemes that are cross-linguistically rare.
    const byRarity = inventory.phonemes
      .map((p) => ({
        segment: p.segment,
        languages: phonemeIndex.index[p.segment]?.length ?? 0,
      }))
      .filter((x) => x.languages > 0)
      .sort((a, b) => a.languages - b.languages);

    if (byRarity.length > 0) {
      const rarest = byRarity[0];
      facts.push({
        title: 'Rarest phoneme',
        body: (
          <>
            <span className="ipa text-base">{rarest.segment}</span> is the
            rarest phoneme in this inventory — it appears in only{' '}
            <strong>{rarest.languages.toLocaleString()}</strong> of{' '}
            {phonemeIndex.distinctSegments.toLocaleString()} documented
            segments worldwide.
          </>
        ),
      });
    }
  }

  return facts;
}

function buildGraphemeFacts(gp: GraphemePhoneme): FactProps[] {
  const facts: FactProps[] = [];

  // Grapheme fan-out: which grapheme maps to the most distinct phonemes?
  const byG = new Map<string, Map<string, number>>();
  const byP = new Map<string, Map<string, number>>();
  for (const m of gp.mappings) {
    (byG.get(m.grapheme) ?? (byG.set(m.grapheme, new Map()), byG.get(m.grapheme)!)).set(
      m.phoneme,
      (byG.get(m.grapheme)!.get(m.phoneme) ?? 0) + m.count
    );
    (byP.get(m.phoneme) ?? (byP.set(m.phoneme, new Map()), byP.get(m.phoneme)!)).set(
      m.grapheme,
      (byP.get(m.phoneme)!.get(m.grapheme) ?? 0) + m.count
    );
  }

  const graphemeFanout = [...byG.entries()]
    .map(([g, m]) => ({ g, n: m.size, total: [...m.values()].reduce((a, x) => a + x, 0) }))
    .sort((a, b) => b.n - a.n || b.total - a.total);

  if (graphemeFanout.length > 0 && graphemeFanout[0].n >= 3) {
    const top = graphemeFanout[0];
    const targets = [...(byG.get(top.g)?.entries() ?? [])]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([p]) => p);
    facts.push({
      title: 'Most ambiguous grapheme',
      body: (
        <>
          <span className="font-mono">{top.g}</span> is the most ambiguous
          grapheme — it spells{' '}
          <strong>{top.n}</strong> different phonemes in the lexicon, most
          commonly{' '}
          {targets.map((p, i) => (
            <span key={p}>
              <span className="ipa">{p}</span>
              {i < targets.length - 1 ? ', ' : ''}
            </span>
          ))}
          .
        </>
      ),
    });
  }

  const phonemeFanin = [...byP.entries()]
    .map(([p, m]) => ({ p, n: m.size, total: [...m.values()].reduce((a, x) => a + x, 0) }))
    .sort((a, b) => b.n - a.n || b.total - a.total);

  if (phonemeFanin.length > 0 && phonemeFanin[0].n >= 3) {
    const top = phonemeFanin[0];
    const sources = [...(byP.get(top.p)?.entries() ?? [])]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([g]) => g);
    facts.push({
      title: 'Most variable phoneme',
      body: (
        <>
          <span className="ipa">{top.p}</span> is the most variably-spelled
          phoneme — it's written as{' '}
          <strong>{top.n}</strong> different graphemes, including{' '}
          {sources.map((g, i) => (
            <span key={g}>
              <span className="font-mono">{g}</span>
              {i < sources.length - 1 ? ', ' : ''}
            </span>
          ))}
          .
        </>
      ),
    });
  }

  return facts;
}
