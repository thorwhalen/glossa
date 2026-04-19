import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { X, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAudio } from '../../hooks/useAudio';
import { useGraphemePhoneme } from '../../hooks/useData';
import { hasAudio } from '../../lib/ipa/audio';
import { useSymbolStatus } from '../../store/audio';
import { normalize } from '../../lib/ipa/normalize';
import type { Inventory } from '../../schemas';

interface Props {
  inventory: Inventory;
  /** Grapheme symbol (e.g. "a", "sh", "а"). Null = panel closed. */
  grapheme: string | null;
  /** URL key — used to build phoneme-detail links. */
  langKey: string;
  onClose: () => void;
}

/**
 * Slide-in detail panel for a grapheme. Mirrors PhonemeDetail's
 * visual shape so the two feel like siblings. Shows:
 *
 *   - the grapheme (large)
 *   - Unicode codepoint / name
 *   - every phoneme target from the WikiPron lexicon, with count, share,
 *     example words, inline play button, and a link into the phoneme panel.
 *
 * Graphemes are language-data-only — there's no cross-language index for
 * them — so the panel is simpler than the phoneme side.
 */
export function GraphemeDetail({ inventory, grapheme, langKey, onClose }: Props) {
  const { data: gp } = useGraphemePhoneme(inventory.iso);
  const { play } = useAudio();

  useEffect(() => {
    if (!grapheme) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [grapheme, onClose]);

  /** Phonemes this grapheme maps to, sorted by count desc. */
  const targets = useMemo(() => {
    if (!gp || !grapheme) return [];
    const hits = gp.mappings.filter((m) => m.grapheme === grapheme);
    const total = hits.reduce((a, m) => a + m.count, 0);
    return hits
      .sort((a, b) => b.count - a.count)
      .map((m) => ({
        ...m,
        share: total > 0 ? m.count / total : 0,
      }));
  }, [gp, grapheme]);

  // Inventory segment set (normalized) for showing whether each phoneme
  // target is actually in the PHOIBLE inventory.
  const invSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of inventory.phonemes) {
      s.add(p.segment);
      s.add(normalize(p.segment));
    }
    return s;
  }, [inventory]);

  return (
    <AnimatePresence>
      {grapheme && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50"
            aria-hidden="true"
          />
          <motion.aside
            key="panel"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'tween', duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Grapheme ${grapheme}`}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-screen sm:max-h-none sm:w-[420px] sm:rounded-none sm:border-l sm:border-t-0"
          >
            <header className="flex items-start justify-between gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  grapheme
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  in {inventory.name}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                aria-label="close"
              >
                <X size={18} />
              </button>
            </header>

            <section className="flex flex-col items-center gap-2 border-b border-neutral-200 px-4 py-8 dark:border-neutral-800">
              <span className="select-all font-mono text-[96px] leading-none text-neutral-900 dark:text-neutral-100">
                {grapheme}
              </span>
              <p className="text-xs text-neutral-500">
                {describeUnicode(grapheme)}
              </p>
            </section>

            <section className="p-4">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Maps to{' '}
                <span className="font-normal normal-case">
                  ({targets.length} phoneme{targets.length === 1 ? '' : 's'})
                </span>
              </h3>
              {targets.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No alignments found for this grapheme.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {targets.map((t) => (
                    <TargetRow
                      key={t.phoneme}
                      phoneme={t.phoneme}
                      count={t.count}
                      share={t.share}
                      examples={t.examples}
                      inInventory={
                        invSet.has(t.phoneme) || invSet.has(normalize(t.phoneme))
                      }
                      langKey={langKey}
                      onPlay={() => play(t.phoneme)}
                    />
                  ))}
                </ul>
              )}
              {targets.some((t) => t.count <= 2) && (
                <p className="mt-4 text-[11px] text-neutral-500">
                  Rare edges (count ≤ 2) are often alignment noise from
                  words where length happens to match without true 1-to-1
                  correspondence — treat them skeptically.
                </p>
              )}
            </section>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function TargetRow({
  phoneme,
  count,
  share,
  examples,
  inInventory,
  langKey,
  onPlay,
}: {
  phoneme: string;
  count: number;
  share: number;
  examples: string[];
  inInventory: boolean;
  langKey: string;
  onPlay: () => void;
}) {
  const { status } = useSymbolStatus(phoneme);
  const canPlay = hasAudio(phoneme);
  const isLoading = status === 'loading';

  return (
    <li className="rounded-md border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3">
        <Link
          to={`/lang/${langKey}/phoneme/${encodeURIComponent(phoneme)}`}
          className="ipa inline-flex min-w-[2.5rem] items-center justify-center rounded border border-neutral-200 bg-white px-2 py-1 text-base hover:border-accent dark:border-neutral-800 dark:bg-neutral-900"
          title="open phoneme detail"
        >
          {phoneme}
          {!inInventory && (
            <span
              className="ml-1 text-[10px] text-amber-600"
              title="not in PHOIBLE inventory"
            >
              ?
            </span>
          )}
        </Link>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="absolute inset-y-0 left-0 bg-accent"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </div>
        <span className="w-12 text-right text-xs text-neutral-500 tabular-nums">
          {count.toLocaleString()}
        </span>
        <button
          type="button"
          onClick={onPlay}
          disabled={!canPlay}
          className="rounded-full p-1.5 text-neutral-500 transition hover:bg-accent/10 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`play ${phoneme}`}
          title={canPlay ? 'play' : 'no recording'}
        >
          <Volume2
            size={14}
            className={isLoading ? 'animate-pulse' : ''}
          />
        </button>
      </div>
      {examples.length > 0 && (
        <p className="mt-1.5 pl-[calc(2.5rem+0.75rem)] text-[11px] text-neutral-500">
          e.g. {examples.slice(0, 3).join(', ')}
        </p>
      )}
    </li>
  );
}

/** "U+0061 · Latin small letter 'a'" — best-effort via Intl if available. */
function describeUnicode(text: string): string {
  if (!text) return '';
  const first = text.codePointAt(0);
  if (first === undefined) return '';
  const hex = first.toString(16).toUpperCase().padStart(4, '0');
  const extra = text.length > 1 ? ` (${text.length} chars)` : '';
  // Intl.DisplayNames type "chars" is non-standard — supported only in a
  // few browsers. We keep the feature detection but cast through to avoid
  // TS complaining about the non-standard literal.
  try {
    const DN = Intl.DisplayNames as unknown as {
      new (locales: string[], opts: { type: string }): { of(s: string): string | undefined };
    };
    const dn = new DN(['en'], { type: 'chars' });
    const name = dn.of?.(text);
    if (name) return `U+${hex}${extra} · ${name}`;
  } catch {
    /* noop */
  }
  return `U+${hex}${extra}`;
}
