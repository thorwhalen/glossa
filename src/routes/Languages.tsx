import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useLanguagesIndex } from '../hooks/useData';
import type { LanguageSummary } from '../schemas';

type SortKey = 'name' | 'phonemes' | 'iso';
const SORT_KEYS: readonly SortKey[] = ['name', 'phonemes', 'iso'];

export function Languages() {
  const { data, isLoading, error } = useLanguagesIndex();
  // The search, the sort and "all variants" live in the address (?q=&sort=&all=1): a link or a
  // reload reopens the same list, and Back undoes a sort or the variants switch.
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const sortParam = params.get('sort') as SortKey | null;
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'name';
  const showAll = params.get('all') === '1';
  const update = (patch: Record<string, string | null>, { replace = false } = {}) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace },
    );
  const setQuery = (q: string) => update({ q }, { replace: true }); // typing refines the same entry
  const setSort = (s: SortKey) => update({ sort: s === 'name' ? null : s });
  const setShowAll = (on: boolean | ((was: boolean) => boolean)) => {
    const v = typeof on === 'function' ? on(showAll) : on;
    update({ all: v ? '1' : null });
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    // Search matches: displayName (includes dialect), name, ISO, glottocode, dialect.
    const matches = q
      ? data.languages.filter(
          (l) =>
            l.displayName.toLowerCase().includes(q) ||
            l.name.toLowerCase().includes(q) ||
            l.iso.toLowerCase().includes(q) ||
            (l.dialect ?? '').toLowerCase().includes(q) ||
            (l.glottocode ?? '').toLowerCase().includes(q)
        )
      : data.languages;

    // When not searching, default to primary inventories only — otherwise the
    // list is ~3000 entries dominated by variants.
    const scoped =
      !q && !showAll ? matches.filter((l) => l.isPrimary) : matches;

    const sorted = [...scoped];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) =>
          a.displayName
            .toLowerCase()
            .localeCompare(b.displayName.toLowerCase())
        );
        break;
      case 'phonemes':
        sorted.sort((a, b) => b.phonemeCount - a.phonemeCount);
        break;
      case 'iso':
        sorted.sort(
          (a, b) =>
            a.iso.localeCompare(b.iso) ||
            (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1)
        );
        break;
    }
    return sorted;
  }, [data, query, sort, showAll]);

  const primaryCount = data?.languages.filter((l) => l.isPrimary).length ?? 0;
  const totalCount = data?.count ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <nav className="mb-6 text-sm">
        <Link to="/" className="text-accent hover:underline">
          ← home
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Languages</h1>
        {data && (
          <p className="mt-1 text-sm text-neutral-500">
            {primaryCount.toLocaleString()} languages ·{' '}
            {totalCount.toLocaleString()} inventories from PHOIBLE
          </p>
        )}
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            size={16}
          />
          <input
            type="search"
            autoFocus
            placeholder="Search by name, dialect, or ISO code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-9 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-900"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              aria-label="clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="name">Sort: Name</option>
          <option value="phonemes">Sort: Phoneme count</option>
          <option value="iso">Sort: ISO code</option>
        </select>
      </div>

      {!query && (
        <label className="mb-3 inline-flex items-center gap-2 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="rounded"
          />
          Show all variants (including non-primary inventories like "English
          (British)", "American English", etc.)
        </label>
      )}

      {isLoading && <p className="text-neutral-500">Loading languages…</p>}
      {error && <p className="text-red-600">Error: {String(error)}</p>}

      {data && (
        <>
          <p className="mb-3 text-xs text-neutral-500">
            {filtered.length.toLocaleString()} result
            {filtered.length === 1 ? '' : 's'}
          </p>
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {filtered.slice(0, 500).map((lang) => (
              <LanguageRow key={lang.key} lang={lang} />
            ))}
          </ul>
          {filtered.length > 500 && (
            <p className="mt-3 text-xs text-neutral-500">
              Showing first 500 of {filtered.length.toLocaleString()}. Narrow
              your search.
            </p>
          )}
        </>
      )}
    </main>
  );
}

function LanguageRow({ lang }: { lang: LanguageSummary }) {
  return (
    <li>
      <Link
        to={`/lang/${lang.key}`}
        className="flex items-center justify-between gap-4 bg-white px-4 py-3 transition hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">
            {lang.displayName}
            {!lang.isPrimary && (
              <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-normal text-neutral-500 dark:bg-neutral-800">
                variant
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {lang.iso}
            {lang.glottocode ? ` · ${lang.glottocode}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono text-sm text-neutral-700 dark:text-neutral-300">
            {lang.phonemeCount}
          </span>
          <span className="ml-1 text-xs text-neutral-500">phonemes</span>
        </div>
      </Link>
    </li>
  );
}
