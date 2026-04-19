import { motion } from 'framer-motion';
import {
  CONSONANT_GRID,
  CONSONANT_MANNERS,
  CONSONANT_PLACES,
  type Cell,
} from '../../lib/ipa/consonants';
import { hasAudio } from '../../lib/ipa/audio';

interface Props {
  /**
   * If provided, only these segments render as "active" (filled). Others
   * render as dim outlines so the grid structure stays visible.
   * If omitted, every segment on the grid renders as active.
   */
  activeSegments?: Set<string>;
  onSelect?: (segment: string) => void;
}

export function IpaConsonantChart({ activeSegments, onSelect }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-inherit px-2 py-2 text-left font-medium text-neutral-500">
              Pulmonic consonants
            </th>
            {CONSONANT_PLACES.map((p) => (
              <th
                key={p}
                className="px-1 py-2 text-center font-medium text-neutral-500 [writing-mode:vertical-rl] rotate-180"
                style={{ minWidth: 48 }}
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CONSONANT_GRID.map((row, rIdx) => (
            <tr key={CONSONANT_MANNERS[rIdx]}>
              <th className="sticky left-0 whitespace-nowrap bg-inherit px-2 py-1 text-left font-medium text-neutral-600 dark:text-neutral-400">
                {CONSONANT_MANNERS[rIdx]}
              </th>
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  className={
                    cell.kind === 'shaded'
                      ? 'border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900'
                      : 'border border-neutral-200 p-0.5 dark:border-neutral-800'
                  }
                >
                  {cell.kind === 'pair' && (
                    <CellPair
                      cell={cell}
                      activeSegments={activeSegments}
                      onSelect={onSelect}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellPair({
  cell,
  activeSegments,
  onSelect,
}: {
  cell: Extract<Cell, { kind: 'pair' }>;
  activeSegments?: Set<string>;
  onSelect?: (segment: string) => void;
}) {
  return (
    <div className="flex items-stretch justify-center gap-0.5">
      <Tile
        segment={cell.voiceless}
        variant="voiceless"
        activeSegments={activeSegments}
        onSelect={onSelect}
      />
      <Tile
        segment={cell.voiced}
        variant="voiced"
        activeSegments={activeSegments}
        onSelect={onSelect}
      />
    </div>
  );
}

function Tile({
  segment,
  variant,
  activeSegments,
  onSelect,
}: {
  segment: string | null;
  variant: 'voiceless' | 'voiced';
  activeSegments?: Set<string>;
  onSelect?: (segment: string) => void;
}) {
  if (!segment) {
    return <span className="inline-block min-w-[1.25rem]" aria-hidden="true" />;
  }
  const active = !activeSegments || activeSegments.has(segment);
  const audio = hasAudio(segment);

  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(segment)}
      whileHover={active ? { y: -1 } : undefined}
      whileTap={active ? { scale: 0.96 } : undefined}
      transition={{ duration: 0.12 }}
      className={[
        'ipa min-w-[1.5rem] rounded px-1.5 py-1 text-base leading-none',
        active
          ? variant === 'voiced'
            ? 'bg-accent/10 text-neutral-900 hover:bg-accent/20 dark:bg-accent/20 dark:text-neutral-100'
            : 'border border-neutral-300 bg-white text-neutral-900 hover:border-accent hover:shadow-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
          : 'text-neutral-300 dark:text-neutral-700',
        !audio && active ? 'opacity-60' : '',
      ].join(' ')}
      aria-label={`phoneme ${segment} (${variant})`}
      aria-pressed={false}
      title={audio ? 'click to play' : 'no recording'}
    >
      {segment}
    </motion.button>
  );
}
