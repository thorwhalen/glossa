import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useInventory, useLexicon } from '../hooks/useData';
import { useAudio } from '../hooks/useAudio';
import { IpaConsonantChart } from '../features/chart/IpaConsonantChart';
import { IpaVowelChart } from '../features/chart/IpaVowelChart';
import { PhonemeDetail } from '../features/phoneme-detail/PhonemeDetail';
import { GraphemeTab } from '../features/grapheme-tab/GraphemeTab';
import { Tabs } from '../components/Tabs';

// react-force-graph-2d is ~400KB — load only when the mapping tab is opened.
const MappingGraph = lazy(() =>
  import('../features/mapping-graph/MappingGraph').then((m) => ({
    default: m.MappingGraph,
  }))
);
import { allConsonantSegments } from '../lib/ipa/consonants';
import { VOWELS } from '../lib/ipa/vowels';

const CANONICAL_SEGMENTS = new Set([
  ...allConsonantSegments(),
  ...VOWELS.map((v) => v.segment),
]);

type TabId = 'chart' | 'graphemes' | 'mapping';

export function LanguagePage() {
  const { iso, symbol } = useParams<{ iso: string; symbol?: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useInventory(iso);
  const { data: lexicon } = useLexicon(iso);
  const { play } = useAudio();
  const [tab, setTab] = useState<TabId>('chart');

  const activeSegments = useMemo(
    () => (data ? new Set(data.phonemes.map((p) => p.segment)) : undefined),
    [data]
  );

  const decodedSymbol = symbol ? decodeURIComponent(symbol) : null;
  const hasLexicon = Boolean(lexicon);

  const selectPhoneme = (seg: string) => {
    if (!iso) return;
    play(seg);
    navigate(`/lang/${iso}/phoneme/${encodeURIComponent(seg)}`);
  };
  const closePanel = () => {
    if (!iso) return;
    navigate(`/lang/${iso}`);
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <nav className="mb-6 text-sm">
        <Link to="/" className="text-accent hover:underline">
          ← home
        </Link>
        <span className="mx-2 text-neutral-300">·</span>
        <Link to="/languages" className="text-accent hover:underline">
          all languages
        </Link>
      </nav>

      {isLoading && <p className="text-neutral-500">Loading inventory…</p>}

      {error && (
        <p className="text-red-600">Error loading inventory: {String(error)}</p>
      )}

      {data && activeSegments && iso && (
        <>
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              {data.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {data.iso} · {data.phonemes.length} phonemes · source:{' '}
              {data.source}
              {' · '}
              <Link
                to={`/compare/${iso}`}
                className="text-accent hover:underline"
              >
                compare with another
              </Link>
            </p>
          </header>

          <Tabs
            tabs={[
              { id: 'chart', label: 'IPA chart' },
              {
                id: 'graphemes',
                label: 'Graphemes',
                disabled: !hasLexicon,
                hint: hasLexicon
                  ? undefined
                  : 'No WikiPron lexicon for this language yet',
              },
              {
                id: 'mapping',
                label: 'Mapping',
                disabled: !hasLexicon,
                hint: hasLexicon
                  ? undefined
                  : 'No WikiPron lexicon for this language yet',
              },
            ]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'chart' && (
            <ChartView
              inventory={data}
              activeSegments={activeSegments}
              onSelect={selectPhoneme}
            />
          )}
          {tab === 'graphemes' && <GraphemeTab iso={iso} />}
          {tab === 'mapping' && (
            <Suspense
              fallback={<p className="text-neutral-500">Loading graph…</p>}
            >
              <MappingGraph iso={iso} />
            </Suspense>
          )}

          <PhonemeDetail
            inventory={data}
            symbol={decodedSymbol}
            onClose={closePanel}
          />
        </>
      )}
    </main>
  );
}

function ChartView({
  inventory,
  activeSegments,
  onSelect,
}: {
  inventory: import('../schemas').Inventory;
  activeSegments: Set<string>;
  onSelect: (s: string) => void;
}) {
  return (
    <>
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Consonants
        </h2>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <IpaConsonantChart
            activeSegments={activeSegments}
            onSelect={onSelect}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Vowels
        </h2>
        <div className="flex justify-center rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <IpaVowelChart activeSegments={activeSegments} onSelect={onSelect} />
        </div>
      </section>

      <OffChartPhonemes
        all={inventory.phonemes.map((p) => p.segment)}
        onSelect={onSelect}
      />
    </>
  );
}

function OffChartPhonemes({
  all,
  onSelect,
}: {
  all: string[];
  onSelect: (s: string) => void;
}) {
  const offChart = all.filter((s) => !CANONICAL_SEGMENTS.has(s));
  if (offChart.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
        Other segments <span className="font-normal">({offChart.length})</span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {offChart.map((seg, i) => (
          <button
            type="button"
            key={`${seg}-${i}`}
            onClick={() => onSelect(seg)}
            className="ipa rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-base shadow-sm transition hover:border-accent dark:border-neutral-800 dark:bg-neutral-900"
          >
            {seg}
          </button>
        ))}
      </div>
    </section>
  );
}
