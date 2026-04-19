import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useGraphemePhoneme,
  useInventory,
  useLanguagesIndex,
  useLexicon,
  usePhonemeIndex,
} from '../hooks/useData';
import { useAudio } from '../hooks/useAudio';
import { IpaConsonantChart } from '../features/chart/IpaConsonantChart';
import { IpaVowelChart } from '../features/chart/IpaVowelChart';
import { Suprasegmentals } from '../features/chart/Suprasegmentals';
import { PhonemeDetail } from '../features/phoneme-detail/PhonemeDetail';
import { GraphemeTab } from '../features/grapheme-tab/GraphemeTab';
import { FunFacts } from '../features/fun-facts/FunFacts';
import { Tabs } from '../components/Tabs';
import {
  buildInventoryOverlay,
  type InventoryOverlay,
} from '../lib/ipa/inventoryOverlay';
import type { LanguageSummary } from '../schemas';

const MappingGraph = lazy(() =>
  import('../features/mapping-graph/MappingGraph').then((m) => ({
    default: m.MappingGraph,
  }))
);

type TabId = 'chart' | 'graphemes' | 'mapping';

export function LanguagePage() {
  const { iso, symbol } = useParams<{ iso: string; symbol?: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useInventory(iso);
  const { data: lexicon } = useLexicon(iso);
  const { play } = useAudio();
  const [tab, setTab] = useState<TabId>('chart');

  const { data: gp } = useGraphemePhoneme(iso);
  const { data: phonemeIndex } = usePhonemeIndex();
  const { data: languagesIndex } = useLanguagesIndex();

  const overlay = useMemo(
    () => (data ? buildInventoryOverlay(data) : null),
    [data]
  );

  const summary = useMemo<LanguageSummary | undefined>(
    () => languagesIndex?.languages.find((l) => l.iso === iso),
    [languagesIndex, iso]
  );

  const medianPhonemeCount = useMemo(() => {
    if (!languagesIndex) return undefined;
    const sorted = [...languagesIndex.languages]
      .map((l) => l.phonemeCount)
      .sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [languagesIndex]);

  const decodedSymbol = symbol ? decodeURIComponent(symbol) : null;
  const hasLexicon = Boolean(lexicon);

  // Chart tiles are canonical base symbols. Clicking `e` in Swedish should
  // open the detail for `eː` (the inventory variant). Resolve here.
  const resolveChartClick = (base: string): string => {
    if (!overlay) return base;
    const variants = overlay.baseToInventory.get(base);
    return variants && variants.length > 0 ? variants[0] : base;
  };

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

      {data && overlay && iso && (
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
            <>
              <ChartView
                overlay={overlay}
                onBaseClick={(base) => selectPhoneme(resolveChartClick(base))}
                onDirectClick={selectPhoneme}
              />
              <FunFacts
                inventory={data}
                summary={summary}
                gp={gp}
                phonemeIndex={phonemeIndex}
                medianPhonemeCount={medianPhonemeCount}
              />
            </>
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
  overlay,
  onBaseClick,
  onDirectClick,
}: {
  overlay: InventoryOverlay;
  onBaseClick: (base: string) => void;
  onDirectClick: (segment: string) => void;
}) {
  return (
    <>
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Consonants
        </h2>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <IpaConsonantChart
            activeSegments={overlay.activeBases}
            onSelect={onBaseClick}
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Vowels
        </h2>
        <div className="flex justify-center rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <IpaVowelChart
            activeSegments={overlay.activeBases}
            onSelect={onBaseClick}
          />
        </div>
      </section>

      <Suprasegmentals
        diphthongs={overlay.diphthongs}
        tones={overlay.tones}
        modifiedVariants={overlay.modifiedVariants}
        offChart={overlay.offChart}
        onSelect={onDirectClick}
      />
    </>
  );
}
