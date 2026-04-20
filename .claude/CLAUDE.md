# glossa

**Phoneme ↔ Grapheme Explorer** — a static-deployed React app that lets you
browse the phoneme inventory of any of ~2000 languages (PHOIBLE), see how
graphemes map to phonemes (WikiPron), and hear each IPA segment pronounced
(Wikimedia Commons).

Deployed at **https://apps.thorwhalen.com/glossa/**. The old URL
**/phogra/** is preserved as a redirect to `/glossa/` for back-compat
(project was renamed phogra → glossa).

## Stack at a glance

- **Vite + React 19 + TypeScript (strict)** — single-page app, no backend
- **Tailwind CSS** for styling, shadcn/ui conventions (no bespoke CSS files)
- **Zod** schemas are the SSOT for every on-disk JSON; TS types are inferred
- **@tanstack/react-query** for data loading (everything static → `staleTime: Infinity`)
- **react-router-dom v6** for routing
- **framer-motion** for subtle motion on hover + panel slide-ins
- **react-force-graph-2d** for the bipartite mapping graph (code-split)
- **Python uv** under `data-prep/` — one source adapter per upstream data source

## Project layout

```
data-prep/            Python (uv) — PHOIBLE, WikiPron source adapters, CLI orchestrator
public/data/          Generated JSON bundles (gitignored — regenerable)
src/
  schemas/            Zod schemas — SSOT for all JSON shapes
  lib/                IPA chart layout, feature grouping, data facade, audio URL map
  hooks/              useInventory, useLanguagesIndex, useLexicon, useAudio, etc.
  features/           chart/, phoneme-detail/, grapheme-tab/, mapping-graph/
  routes/             Home, Languages, LanguagePage, ComparePage
  components/         Tabs, AppShell (dark-mode toggle)
scripts/deploy.sh     Build + rsync + HUP gunicorn (see Deploy)
```

## Data pipeline

Regenerate all JSON bundles (PHOIBLE + WikiPron + alignments):

```bash
cd data-prep && uv sync && uv run glossa-data-prep run-all
```

Each source module under `data-prep/glossa_data_prep/sources/` exposes the
same three-function plugin interface: `fetch(cache_dir)`, `parse(raw_path)`,
`emit(parsed, out_dir)`. Adding a new source = drop a module in that dir and
register it in `cli.py`'s `SOURCES` dict.

**Important**: `public/data/` is gitignored. Bundles are 80+ MB and fully
derivable from the data-prep pipeline. Never hand-edit them. Corrective
edits to prepared data should go through an _overlays_ layer (planned — see
the repo README's "Roadmap" section) rather than by patching bundles in
place.

**Coverage notes**:
- PHOIBLE: all 2094 languages (one inventory per ISO, biggest chosen)
- WikiPron lexicons + grapheme alignments: 13 languages (eng, fra, spa, deu, ita, jpn, kor, nld, pol, por, rus, hin, tur). `arb` and `cmn` aren't in WikiPron's scrape dir.
- Wikimedia Commons audio: hardcoded IPA→filename table in `src/lib/ipa/audio.ts` covering ~80 common pulmonic segments. Unknown segments show "no recording".

## Routing

- `/` — landing page with universal IPA chart + suggested languages
- `/languages` — searchable/sortable list of all 2094 languages
- `/lang/:iso` — language page with tabbed views (chart / graphemes / mapping)
- `/lang/:iso/phoneme/:symbol` — same page + phoneme detail panel open (deep-linkable)
- `/compare/:iso?with=:other` — side-by-side comparison

The app is mounted under `/glossa/` in production. Vite's `base` + React
Router's `basename` both read from the same config — see `vite.config.ts` and
`src/main.tsx`. For local dev override with `VITE_BASE=/ npm run dev`.

## Deploy

Target: `enlace` platform on the thorwhalen.com server. Glossa lives as a
static-frontend-only app at `/opt/tw_platform/apps/glossa/frontend/` and
gets mounted at `/glossa/` by enlace's auto-discovery.

The old `/opt/tw_platform/apps/phogra/frontend/` directory is kept, but
now contains only an `index.html` that 302-redirects any `/phogra/…` URL to
the matching `/glossa/…` URL. The redirect stub is (re)written by
`scripts/deploy.sh` every deploy — don't hand-edit it.

**Redeploy from this server**:

```bash
./scripts/deploy.sh
```

The script: builds production bundle, rsyncs `dist/` to
`apps/glossa/frontend/`, refreshes the `apps/phogra/frontend/` redirect
stub, and sends `SIGHUP` to the gunicorn master for a zero-downtime reload.

**HUP vs restart — pick the right tool:**

- **HUP** (what `scripts/deploy.sh` does) is correct when only the frontend
  `dist/` or the Python **app code** in `/opt/tw_platform/apps/` has
  changed. Gunicorn's master re-spawns workers without dropping the
  listening socket, so there's no downtime.
- **`systemctl restart enlace-backend`** is required after **any venv
  mutation** — `pip install`, `pip install -e`, editable reinstalls,
  dependency upgrades. Reason: gunicorn's master loads `site.py` (and
  thus processes `.pth` files) once at startup. When you HUP, new workers
  fork from the master and inherit its in-memory `sys.path`. If the
  on-disk venv was rewritten after the master started, that `sys.path`
  is stale and workers can fail to boot with `ModuleNotFoundError`
  (systemd will auto-restart on failure, so the outage is short, but
  it's still an outage).

Rule of thumb: if anything under `/opt/tw_platform/venv/` changed, it's a
restart. Otherwise, HUP.

## Dev conventions

- **Zod-validate on load** — every JSON fetched from `public/data/` gets
  parsed by its schema. Drift surfaces immediately.
- **Small components with typed props** — no prop drilling, no class
  components.
- **Code-split heavy routes** — `ComparePage` and `MappingGraph` are lazy
  imports to keep the initial bundle small (react-force-graph is ~190 kB).
- **Typography & layout are load-bearing** — the IPA chart structure is
  spec-defined (`lib/ipa/consonants.ts`). Don't refactor it casually; it's
  meant to look like the real IPA chart.
- **Dark mode is first-class** — verify every new UI block in both themes.
  Tailwind `dark:` classes only; no media-query CSS.

## Gotchas

- **"English (New Zealand)"** shows up for `eng` because PHOIBLE has ~5
  English inventories and we pick the largest. Later: expose inventory
  choice in the UI.
- **Korean grapheme tab is thin** (10 alignment pairs) — the v1 greedy 1:1
  aligner is weak for syllabaries/abugidas. Future work: per-language
  alignment strategy + a grapheme model that admits multi-character units
  (digraphs/trigraphs like `ch`, `ai`, `eau`).
- **Language metadata is thin** — `family` / `macroarea` / coordinates are
  `null` until a Glottolog source adapter is written. Placeholder only.
- **arb and cmn have no WikiPron lexicon** — the Graphemes and Mapping tabs
  show a friendly "no lexicon" placeholder for these.
