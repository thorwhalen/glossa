import { Link } from 'react-router-dom';
import { useLanguagesIndex } from '../hooks/useData';
import { useAudio } from '../hooks/useAudio';
import { IpaConsonantChart } from '../features/chart/IpaConsonantChart';
import { IpaVowelChart } from '../features/chart/IpaVowelChart';

// Suggested languages for the landing page. Keep in sync with
// data-prep/phogra_data_prep/sources/wikipron.py SUGGESTED_ISOS.
const SUGGESTED = [
  'eng',
  'fra',
  'spa',
  'deu',
  'ita',
  'jpn',
  'kor',
  'cmn',
  'arb',
  'rus',
  'hin',
  'por',
  'nld',
  'tur',
  'pol',
  'swe',
  'hrv',
  'srp',
];

export function Home() {
  const { data, isLoading, error } = useLanguagesIndex();
  const { play } = useAudio();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight">
          Phoneme ↔ Grapheme Explorer
        </h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Browse the sound systems of the world's languages.
        </p>
      </header>

      <section className="mb-16">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-500">
          The universal IPA chart
        </h2>
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          Click any symbol to hear it. Pick a language below to see which
          segments it uses.
        </p>
        <div className="mb-10 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <IpaConsonantChart onSelect={play} />
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Vowels
          </h3>
          <div className="flex justify-center">
            <IpaVowelChart onSelect={play} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Try a language
        </h2>
        {isLoading && <p className="text-neutral-500">Loading…</p>}
        {error && (
          <p className="text-red-600">Error: {String(error)}</p>
        )}
        {data && (
          <>
            <ul className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SUGGESTED.map((iso) => {
                // Prefer the primary inventory for each suggested ISO.
                const lang =
                  data.languages.find(
                    (l) => l.iso === iso && l.isPrimary
                  ) ?? data.languages.find((l) => l.iso === iso);
                if (!lang) return null;
                return (
                  <li key={lang.key}>
                    <Link
                      to={`/lang/${lang.key}`}
                      className="block rounded-md border border-neutral-200 bg-white px-4 py-3 shadow-sm transition hover:border-accent hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <span className="block font-medium">{lang.name}</span>
                      <span className="mt-1 block text-xs text-neutral-500">
                        {lang.iso} · {lang.phonemeCount} phonemes
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              to="/languages"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              Browse all {data.count.toLocaleString()} inventories →
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
