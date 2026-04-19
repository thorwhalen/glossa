import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
  Globe,
  BookOpen,
  Copy,
  Check,
} from 'lucide-react';
import type { Inventory, Phoneme } from '../../schemas';
import { useAudio } from '../../hooks/useAudio';
import { useGraphemePhoneme, usePhonemeIndex } from '../../hooks/useData';
import { hasAudio, isAudioApproximated } from '../../lib/ipa/audio';
import { useSymbolStatus } from '../../store/audio';
import { groupedFeatures } from '../../lib/features';
import { normalize } from '../../lib/ipa/normalize';

interface Props {
  inventory: Inventory;
  symbol: string | null;
  onClose: () => void;
}

export function PhonemeDetail({ inventory, symbol, onClose }: Props) {
  // Resolve the phoneme in the PHOIBLE inventory.
  //
  // 1. Exact match (common case).
  // 2. Normalized match — strip length markers and combining diacritics,
  //    so WikiPron's broad `a` matches PHOIBLE's `a̟` (advanced-a).
  // 3. Fallback: we render the panel anyway with whatever we can gather
  //    from WikiPron + the phoneme index; the panel signals that the
  //    symbol isn't a distinct inventory entry in this language.
  const resolved = useMemo(() => {
    if (!symbol) return { phoneme: null, matchKind: 'none' as const };
    const exact = inventory.phonemes.find((p) => p.segment === symbol);
    if (exact) return { phoneme: exact, matchKind: 'exact' as const };
    const norm = normalize(symbol);
    const normalized = inventory.phonemes.find(
      (p) => normalize(p.segment) === norm
    );
    if (normalized)
      return { phoneme: normalized, matchKind: 'normalized' as const };
    return { phoneme: null, matchKind: 'synthetic' as const };
  }, [inventory, symbol]);

  const displayPhoneme: Phoneme | null =
    resolved.phoneme ??
    (symbol
      ? {
          segment: symbol,
          marginal: false,
          allophones: [],
          features: {},
          segmentClass: 'other',
        }
      : null);

  useEffect(() => {
    if (!symbol) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [symbol, onClose]);

  return (
    <AnimatePresence>
      {symbol && displayPhoneme && (
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
            aria-label={`Phoneme ${symbol}`}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-screen sm:max-h-none sm:w-[420px] sm:rounded-none sm:border-l sm:border-t-0"
          >
            <DetailBody
              inventory={inventory}
              phoneme={displayPhoneme}
              matchKind={resolved.matchKind}
              onClose={onClose}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function PlayButton({
  segment,
  canPlay,
  onPlay,
}: {
  segment: string;
  canPlay: boolean;
  onPlay: () => void;
}) {
  const { status, errorMessage } = useSymbolStatus(segment);

  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isPlaying = status === 'playing';
  const approximated = canPlay && isAudioApproximated(segment);

  const label = !canPlay
    ? 'No recording'
    : isLoading
      ? 'Loading…'
      : isError
        ? 'Retry'
        : isPlaying
          ? 'Playing'
          : approximated
            ? 'Play (base)'
            : 'Play';

  const Icon = !canPlay
    ? VolumeX
    : isLoading
      ? Loader2
      : isError
        ? AlertCircle
        : Volume2;

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        className={[
          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition',
          isError
            ? 'bg-red-600 text-white hover:bg-red-500'
            : 'bg-accent text-white hover:bg-accent-muted',
          'disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600 disabled:opacity-60 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-400',
        ].join(' ')}
        aria-label={`play phoneme ${segment}`}
      >
        <Icon size={16} className={isLoading ? 'animate-spin' : ''} />
        {label}
      </button>
      {approximated && (
        <p className="max-w-[260px] text-center text-[11px] text-neutral-500">
          No exact recording. Plays the base IPA segment{' '}
          <span className="ipa font-medium">{normalize(segment)}</span> from
          Commons.
        </p>
      )}
      {!canPlay && (
        <p className="text-[11px] text-neutral-500">
          Not in our Commons audio set
        </p>
      )}
      {isError && errorMessage && (
        <p className="max-w-[220px] text-center text-[11px] text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard denied — silently noop
    }
  };
  return (
    <button
      type="button"
      onClick={doCopy}
      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-2 text-xs text-neutral-600 transition hover:border-accent hover:text-accent dark:border-neutral-700 dark:text-neutral-400"
      aria-label={copied ? 'copied' : 'copy IPA symbol'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function DetailBody({
  inventory,
  phoneme,
  matchKind,
  onClose,
}: {
  inventory: Inventory;
  phoneme: Phoneme;
  matchKind: 'exact' | 'normalized' | 'synthetic' | 'none';
  onClose: () => void;
}) {
  const { play } = useAudio();
  const { data: phonemeIndex } = usePhonemeIndex();
  const { data: gp } = useGraphemePhoneme(inventory.iso);

  const canPlay = hasAudio(phoneme.segment);
  const groups = groupedFeatures(phoneme);
  const appearsIn = phonemeIndex?.index[phoneme.segment]?.length ?? 0;

  const { graphemes, examples } = useMemo(() => {
    if (!gp) return { graphemes: [], examples: [] };
    const gs = gp.mappings
      .filter((m) => m.phoneme === phoneme.segment)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const total = gs.reduce((acc, g) => acc + g.count, 0);
    const withShare = gs.map((g) => ({
      ...g,
      share: total > 0 ? g.count / total : 0,
    }));
    return {
      graphemes: withShare,
      examples: gp.examples[phoneme.segment] ?? [],
    };
  }, [gp, phoneme.segment]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {phoneme.segmentClass}
            {phoneme.marginal && ' · marginal'}
            {matchKind === 'normalized' && ' · normalized match'}
            {matchKind === 'synthetic' && ' · not in inventory'}
          </p>
          <p className="mt-1 text-xs text-neutral-500">in {inventory.name}</p>
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

      {matchKind === 'synthetic' && (
        <section className="border-b border-neutral-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-neutral-800 dark:bg-amber-900/20 dark:text-amber-200">
          <p>
            <strong>Heads-up:</strong> <span className="ipa">{phoneme.segment}</span>{' '}
            is a broad-phonemic target from WikiPron but isn't a distinct
            entry in {inventory.name}'s PHOIBLE inventory. The real inventory
            segment may carry a diacritic (e.g. length, advanced, nasalized).
            Features below are therefore empty.
          </p>
        </section>
      )}

      {matchKind === 'normalized' && (
        <section className="border-b border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          Showing {inventory.name}'s closest inventory segment — the
          WikiPron label normalizes to this one after stripping diacritics.
        </section>
      )}

      <section className="flex flex-col items-center gap-4 border-b border-neutral-200 px-4 py-8 dark:border-neutral-800">
        <span
          className="ipa select-all text-[96px] leading-none text-neutral-900 dark:text-neutral-100"
          aria-label={`IPA symbol ${phoneme.segment}`}
        >
          {phoneme.segment}
        </span>
        <div className="flex items-center gap-2">
          <PlayButton
            segment={phoneme.segment}
            canPlay={canPlay}
            onPlay={() => play(phoneme.segment)}
          />
          <CopyButton text={phoneme.segment} />
        </div>
      </section>

      {graphemes.length > 0 && (
        <section className="border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Graphemes
          </h3>
          <ul className="space-y-1.5">
            {graphemes.map((g) => (
              <li
                key={g.grapheme}
                className="flex items-center gap-3 text-sm"
              >
                <span className="inline-flex min-w-[2.5rem] justify-center rounded border border-neutral-200 bg-white px-2 py-1 font-mono dark:border-neutral-800 dark:bg-neutral-950">
                  {g.grapheme}
                </span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="absolute inset-y-0 left-0 bg-accent"
                    style={{ width: `${Math.round(g.share * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-neutral-500 tabular-nums">
                  {g.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {examples.length > 0 && (
        <section className="border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <BookOpen className="mr-1 inline" size={12} />
            Example words
          </h3>
          <ul className="space-y-1.5 text-sm">
            {examples.slice(0, 5).map((ex, i) => (
              <li key={`${ex.word}-${i}`} className="flex items-baseline gap-3">
                <span className="font-medium">{ex.word}</span>
                <span className="ipa text-xs text-neutral-500">
                  /{ex.ipa.join(' ')}/
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phoneme.allophones.length > 0 && (
        <section className="border-b border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Allophones
          </h3>
          <div className="flex flex-wrap gap-2">
            {phoneme.allophones.map((a, i) => (
              <span
                key={`${a}-${i}`}
                className="ipa rounded bg-neutral-100 px-2 py-1 text-sm dark:bg-neutral-800"
              >
                {a}
              </span>
            ))}
          </div>
        </section>
      )}

      {appearsIn > 1 && (
        <section className="border-b border-neutral-200 p-4 dark:border-neutral-800">
          <p className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <Globe size={14} />
            Appears in {appearsIn.toLocaleString()} languages
          </p>
        </section>
      )}

      <section className="p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Distinctive features
        </h3>
        {groups.length === 0 ? (
          <p className="text-sm text-neutral-500">No features recorded.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {g.label}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {g.entries.map((e) => (
                    <li
                      key={e.feature}
                      className={[
                        'rounded px-2 py-0.5 text-xs',
                        e.value === '+'
                          ? 'bg-accent/10 text-accent dark:bg-accent/20'
                          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800',
                      ].join(' ')}
                    >
                      <span className="font-mono">{e.value}</span>{' '}
                      {e.display}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
