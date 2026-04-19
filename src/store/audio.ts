import { create } from 'zustand';
import { audioUrlFor, hasAudio } from '../lib/ipa/audio';

export type AudioStatus =
  | 'idle'
  /** URL lookup succeeded and we've started fetching. */
  | 'loading'
  /** Playback has begun. */
  | 'playing'
  /** Failed to load or play. Could be 404, network, codec, autoplay block. */
  | 'error'
  /** We have no URL mapping for this symbol — the data, not the network. */
  | 'missing';

interface AudioState {
  /** The symbol the last play attempt was for (null = nothing attempted yet). */
  symbol: string | null;
  status: AudioStatus;
  /** Human-readable error detail for status === 'error'. */
  errorMessage: string | null;
  /** Nonce that changes every play() call so toast animations can key on it. */
  tick: number;
  play: (symbol: string) => void;
  stop: () => void;
}

/**
 * One Audio element lives outside the Zustand state so we don't trigger
 * renders on every readyState tick. React only sees the coarse status
 * transitions we explicitly call set() for.
 */
let el: HTMLAudioElement | null = null;

function cleanup() {
  if (!el) return;
  el.onplaying = null;
  el.onended = null;
  el.onerror = null;
  el.pause();
  try {
    el.src = '';
  } catch {
    /* some browsers throw on src='' — harmless */
  }
}

export const useAudioStore = create<AudioState>((set, get) => ({
  symbol: null,
  status: 'idle',
  errorMessage: null,
  tick: 0,

  play: (symbol) => {
    const tick = get().tick + 1;

    // Case 1: we don't have a URL for this symbol. This is a data-side
    // "missing", distinct from a network failure — the user should see a
    // different message.
    if (!hasAudio(symbol)) {
      cleanup();
      set({
        symbol,
        status: 'missing',
        errorMessage: null,
        tick,
      });
      return;
    }

    const url = audioUrlFor(symbol)!;
    cleanup();
    set({ symbol, status: 'loading', errorMessage: null, tick });

    const audio = new Audio(url);
    el = audio;

    audio.onplaying = () => {
      if (get().symbol === symbol) set({ status: 'playing' });
    };
    audio.onended = () => {
      if (get().symbol === symbol) set({ status: 'idle' });
    };
    audio.onerror = () => {
      if (get().symbol === symbol) {
        set({
          status: 'error',
          errorMessage: 'Could not load the recording from Commons.',
        });
      }
    };

    audio.play().catch((err: unknown) => {
      if (get().symbol === symbol) {
        const msg =
          err instanceof Error ? err.message : 'Playback was blocked.';
        set({ status: 'error', errorMessage: msg });
      }
    });
  },

  stop: () => {
    cleanup();
    set({ symbol: null, status: 'idle', errorMessage: null });
  },
}));

/**
 * Derive the status for a *specific* symbol — "idle" if the store is
 * tracking a different symbol. Useful for per-row speaker icons.
 *
 * Must return primitives from each selector (not a composite object) —
 * Zustand v5's default Object.is equality treats a fresh object as changed
 * every render, which breaks `getSnapshot` caching. Two narrow selectors
 * keep snapshots stable.
 */
export function useSymbolStatus(symbol: string | undefined): {
  status: AudioStatus;
  errorMessage: string | null;
} {
  const status = useAudioStore((s) =>
    symbol && s.symbol === symbol ? s.status : ('idle' as AudioStatus)
  );
  const errorMessage = useAudioStore((s) =>
    symbol && s.symbol === symbol ? s.errorMessage : null
  );
  return { status, errorMessage };
}
