import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';
import { useAudioStore, type AudioStatus } from '../store/audio';

/**
 * Single floating pill, top-right, that mirrors the audio store's state.
 * Appears when a play is attempted and auto-dismisses a beat after success
 * or failure. Stays visible while loading.
 *
 * The user said the sounds "work and sometimes don't — don't know if it's
 * the network or sounds missing". This is the one place that makes the
 * difference legible:
 *
 *   loading → "Loading /p/"
 *   playing → "Playing /p/" (fades after playback begins)
 *   missing → "No recording for /p/ in our set"
 *   error   → "Could not load /p/ — {reason}"
 */
export function AudioStatusToast() {
  // Subscribe to each field individually — Zustand v5 wants stable
  // snapshots per selector, so we avoid the `useAudioStore()` full-state
  // shorthand that returns a fresh object on every change.
  const symbol = useAudioStore((s) => s.symbol);
  const status = useAudioStore((s) => s.status);
  const errorMessage = useAudioStore((s) => s.errorMessage);
  const tick = useAudioStore((s) => s.tick);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      setVisible(false);
      return;
    }
    setVisible(true);
    // Auto-dismiss for terminal states. Keep 'loading' visible until a
    // transition away from it.
    const dismissAfter =
      status === 'playing'
        ? 1400
        : status === 'missing'
          ? 2400
          : status === 'error'
            ? 4000
            : null;
    if (dismissAfter === null) return;
    const t = setTimeout(() => setVisible(false), dismissAfter);
    return () => clearTimeout(t);
    // tick included so re-clicking the same symbol resets the timer.
  }, [status, tick]);

  return (
    <AnimatePresence>
      {visible && symbol && status !== 'idle' && (
        <motion.div
          key={tick}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          className="fixed right-4 top-16 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs shadow-md dark:border-neutral-800 dark:bg-neutral-900"
        >
          <StatusGlyph status={status} />
          <Message status={status} symbol={symbol} detail={errorMessage} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusGlyph({ status }: { status: AudioStatus }) {
  switch (status) {
    case 'loading':
      return (
        <Loader2 size={14} className="animate-spin text-neutral-500" />
      );
    case 'playing':
      return <Volume2 size={14} className="text-accent" />;
    case 'missing':
      return <VolumeX size={14} className="text-neutral-400" />;
    case 'error':
      return <AlertCircle size={14} className="text-red-500" />;
    default:
      return null;
  }
}

function Message({
  status,
  symbol,
  detail,
}: {
  status: AudioStatus;
  symbol: string;
  detail: string | null;
}) {
  if (status === 'loading') {
    return (
      <span>
        Loading <span className="ipa">{symbol}</span>…
      </span>
    );
  }
  if (status === 'playing') {
    return (
      <span>
        Playing <span className="ipa">{symbol}</span>
      </span>
    );
  }
  if (status === 'missing') {
    return (
      <span>
        No recording for <span className="ipa">{symbol}</span> in our set
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span>
        Could not load <span className="ipa">{symbol}</span>
        {detail && (
          <span className="ml-1 text-neutral-500">· {detail}</span>
        )}
      </span>
    );
  }
  return null;
}
