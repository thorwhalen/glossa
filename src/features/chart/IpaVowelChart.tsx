import { motion } from 'framer-motion';
import { VOWELS } from '../../lib/ipa/vowels';
import { hasAudio } from '../../lib/ipa/audio';

interface Props {
  activeSegments?: Set<string>;
  onSelect?: (segment: string) => void;
}

/**
 * Classical IPA vowel trapezoid. Points are placed in an F1/F2-like space
 * and warped into a trapezoid: at height=0 (close) the row spans the full
 * width; at height=1 (open) it spans 70% and is centered.
 */
const WIDTH = 520;
const HEIGHT = 340;
const PAD_X = 80;
const PAD_Y = 40;

function project(backness: number, height: number): { x: number; y: number } {
  const taper = 0.35 * height; // how much to pull in at bottom
  const left = PAD_X + (WIDTH - 2 * PAD_X) * taper * 0.5;
  const right = WIDTH - PAD_X - (WIDTH - 2 * PAD_X) * taper * 0.5;
  const x = left + (right - left) * backness;
  const y = PAD_Y + (HEIGHT - 2 * PAD_Y) * height;
  return { x, y };
}

export function IpaVowelChart({ activeSegments, onSelect }: Props) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full max-w-2xl text-neutral-600 dark:text-neutral-300"
      role="img"
      aria-label="IPA vowel chart"
    >
      {/* Trapezoid outline */}
      <polygon
        points={[
          project(0, 0),
          project(1, 0),
          project(1, 1),
          project(0, 1),
        ]
          .map((p) => `${p.x},${p.y}`)
          .join(' ')}
        className="fill-none stroke-neutral-300 dark:stroke-neutral-700"
        strokeWidth={1.5}
      />

      {/* Axis labels */}
      <text
        x={PAD_X - 8}
        y={PAD_Y - 10}
        className="fill-neutral-500 text-[10px]"
        textAnchor="start"
      >
        Front
      </text>
      <text
        x={WIDTH - PAD_X + 8}
        y={PAD_Y - 10}
        className="fill-neutral-500 text-[10px]"
        textAnchor="end"
      >
        Back
      </text>
      <text
        x={PAD_X - 16}
        y={PAD_Y + 4}
        className="fill-neutral-500 text-[10px]"
        textAnchor="end"
      >
        Close
      </text>
      <text
        x={PAD_X - 16}
        y={HEIGHT - PAD_Y}
        className="fill-neutral-500 text-[10px]"
        textAnchor="end"
      >
        Open
      </text>

      {/* Vowel tokens */}
      {VOWELS.map((v) => {
        const { x, y } = project(v.backness, v.height);
        // Pairs share a point; offset rounded vowel to the right.
        const offsetX = v.rounded ? 10 : v.pairWith ? -10 : 0;
        const active = !activeSegments || activeSegments.has(v.segment);
        const audio = hasAudio(v.segment);
        return (
          <motion.g
            key={v.segment}
            whileHover={active ? { scale: 1.15 } : undefined}
            transition={{ duration: 0.12 }}
            style={{ transformOrigin: `${x + offsetX}px ${y}px` }}
          >
            <circle
              cx={x + offsetX}
              cy={y}
              r={13}
              className={
                active
                  ? v.rounded
                    ? 'fill-accent/15 stroke-accent/50'
                    : 'fill-white stroke-neutral-300 dark:fill-neutral-950 dark:stroke-neutral-700'
                  : 'fill-transparent stroke-neutral-200 dark:stroke-neutral-800'
              }
              strokeWidth={1}
            />
            <text
              x={x + offsetX}
              y={y + 5}
              textAnchor="middle"
              className={[
                'ipa text-[15px] cursor-pointer select-none',
                active
                  ? 'fill-neutral-900 dark:fill-neutral-100'
                  : 'fill-neutral-300 dark:fill-neutral-700',
                !audio && active ? 'opacity-60' : '',
              ].join(' ')}
              onClick={() => onSelect?.(v.segment)}
              role="button"
              aria-label={`vowel ${v.segment}`}
            >
              {v.segment}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
