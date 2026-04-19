import { useCallback, useRef } from 'react';
import { audioUrlFor } from '../lib/ipa/audio';

/**
 * Minimal IPA audio hook. Clicks on a phoneme tile fire `play(symbol)`.
 * v1 is single-channel: a new play interrupts the previous one.
 */
export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((symbol: string) => {
    const url = audioUrlFor(symbol);
    if (!url) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    const audio = new Audio(url);
    audio.play().catch((err) => {
      console.warn(`[audio] failed for ${symbol}:`, err);
    });
    audioRef.current = audio;
  }, []);

  return { play };
}
