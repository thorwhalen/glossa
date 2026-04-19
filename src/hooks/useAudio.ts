import { useAudioStore } from '../store/audio';

/**
 * Thin facade kept for backward compatibility — all the real state lives in
 * the audio store so every component gets synchronized loading/playing/
 * error/missing feedback for free.
 */
export function useAudio() {
  const play = useAudioStore((s) => s.play);
  return { play };
}
