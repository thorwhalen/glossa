import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { GraphemeDetail } from '../features/grapheme-detail/GraphemeDetail';
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
  // URL param :iso is actually a language key — either the ISO 639-3 code
  // (for the primary inventory of that language) or `{iso}-{invId}` for a
  // specific non-primary variant. We preserve the `iso` name for URL
  // back-compat.
  const { iso: key, symbol } = useParams<{ iso: string; symbol?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, isLoading, error } = useInventory(key);
  const { play } = useAudio();
  const [tab, setTab] = useState<TabId>('chart');

  // Distinguish /lang/:key/phoneme/:s from /lang/:key/grapheme/:s by URL
  // shape (React Router v6 doesn't give us a neat kind-discriminator).
  const detailKind: 'phoneme' | 'grapheme' | null = location.pathname.includes(
    '/grapheme/'
  )
    ? 'grapheme'
    : location.pathname.includes('/phoneme/')
      ? 'phoneme'
      : null;

  // Lexicon / grapheme-phoneme data is keyed by ISO (not inventory) because
  // WikiPron aggregates across variants. We read the ISO off the loaded
  // inventory so deep-links to `/lang/eng-2175` still get English lexicon data.
  const actualIso = data?.iso;
  const { data: lexicon } = useLexicon(actualIso);
  const { data: gp } = useGraphemePhoneme(actualIso);
  const { data: phonemeIndex } = usePhonemeIndex();
  const { data: languagesIndex } = useLanguagesIndex();

  const overlay = useMemo(
    () => (data ? buildInventoryOverlay(data) : null),
    [data]
  );

  const summary = useMemo<LanguageSummary | undefined>(
    () => languagesIndex?.languages.find((l) => l.key === key),
    [languagesIndex, key]
  );

  /** All inventories for the same ISO — used for the variant selector. */
  const siblingVariants = useMemo(() => {
    if (!languagesIndex || !actualIso) return [];
    return languagesIndex.languages
      .filter((l) => l.iso === actualIso)
      .sort((a, b) =>
        a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1
      );
  }, [languagesIndex, actualIso]);

  const medianPhonemeCount = useMemo(() => {
    if (!languagesIndex) return undefined;
    const sorted = [...languagesIndex.languages]
      .map((l) => l.phonemeCount)
      .sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }, [languagesIndex]);

  const decodedSymbol = symbol ? decodeURIComponent(symbol) : null;
  const hasLexicon = Boolean(lexicon);

  const resolveChartClick = (base: string): string => {
    if (!overlay) return base;
    const variants = overlay.baseToInventory.get(base);
    return variants && variants.length > 0 ? variants[0] : base;
  };

  const selectPhoneme = (seg: string) => {
    if (!key) return;
    play(seg);
    navigate(`/lang/${key}/phoneme/${encodeURIComponent(seg)}`);
  };
  const selectGrapheme = (g: string) => {
    if (!key) return;
    navigate(`/lang/${key}/grapheme/${encodeURIComponent(g)}`);
  };
  const closePanel = () => {
    if (!key) return;
    navigate(`/lang/${key}`);
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

      {data && overlay && key && actualIso && (
        <>
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              {data.name}
            </h1>
            {data.dialect && (
              <p className="mt-1 text-base text-neutral-600 dark:text-neutral-400">
                {data.dialect}
              </p>
            )}
            <p className="mt-2 text-sm text-neutral-500">
              {data.iso} · {data.phonemes.length} phonemes · source:{' '}
              {data.source}
              {' · '}
              <Link
                to={`/compare/${key}`}
                className="text-accent hover:underline"
              >
                compare with another
              </Link>
            </p>
            {siblingVariants.length > 1 && (
              <VariantSelector
                activeKey={key}
                variants={siblingVariants}
                onPick={(k) => navigate(`/lang/${k}`)}
              />
            )}
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
          {tab === 'graphemes' && (
            <GraphemeTab
              iso={actualIso}
              onSelectGrapheme={selectGrapheme}
              onSelectPhoneme={selectPhoneme}
            />
          )}
          {tab === 'mapping' && (
            <Suspense
              fallback={<p className="text-neutral-500">Loading graph…</p>}
            >
              <MappingGraph
                iso={actualIso}
                inventory={data}
                langKey={key}
                onSelectGrapheme={selectGrapheme}
                onSelectPhoneme={selectPhoneme}
              />
            </Suspense>
          )}

          <PhonemeDetail
            inventory={data}
            symbol={detailKind === 'phoneme' ? decodedSymbol : null}
            onClose={closePanel}
          />
          <GraphemeDetail
            inventory={data}
            grapheme={detailKind === 'grapheme' ? decodedSymbol : null}
            langKey={key}
            onClose={closePanel}
          />
        </>
      )}
    </main>
  );
}

function VariantSelector({
  activeKey,
  variants,
  onPick,
}: {
  activeKey: string;
  variants: LanguageSummary[];
  onPick: (key: string) => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-2 text-sm">
      <label className="text-neutral-500" htmlFor="variant-select">
        Variant:
      </label>
      <select
        id="variant-select"
        value={activeKey}
        onChange={(e) => onPick(e.target.value)}
        className="max-w-full truncate rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-900"
      >
        {variants.map((v) => (
          <option key={v.key} value={v.key}>
            {v.displayName}
            {v.isPrimary ? ' (primary)' : ''} · {v.phonemeCount} phonemes
          </option>
        ))}
      </select>
    </div>
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
