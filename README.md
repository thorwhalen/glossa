# phogra

**Phoneme ↔ Grapheme Explorer** — browse the sound systems of the world's
languages, see IPA charts filtered to each language's inventory, explore how
graphemes map to phonemes, and hear each phoneme pronounced.

Frontend-only, static-deployable (Vite + React + TypeScript). Intended to be
published at **apps.thorwhalen.com**.

## Status

- [x] **M0** — Data pipeline (PHOIBLE, WikiPron) + Zod schemas + smoke-test
- [x] **M1** — Universal IPA chart + Commons audio
- [x] **M2** — Language list + inventory filter
- [x] **M3** — Phoneme detail panel (graphemes, example words, features)
- [x] **M4** — Grapheme tab
- [x] **M5** — Mapping graph (grapheme ↔ phoneme, lazy-loaded)
- [x] **M6** — Compare two languages
- [x] **M7** — Polish (dark mode, copy-IPA, font self-hosting, code splitting)

Deployed at **https://apps.thorwhalen.com/phogra/**. Redeploy with:

```bash
./scripts/deploy.sh
```

(The script builds, rsyncs to `/opt/tw_platform/apps/phogra/frontend/`, and
sends `SIGHUP` to the gunicorn master for a zero-downtime reload.)

## Running locally

```bash
# install JS deps
npm install

# regenerate the data bundle (see "Data pipeline" below)
cd data-prep && uv sync && uv run phogra-data-prep run-all && cd ..

# dev server
npm run dev

# production build
npm run build
```

Open http://localhost:5173, click a language, see its phoneme inventory.

## Data pipeline

The `data-prep/` Python package downloads each external source, parses it,
and emits compact JSON bundles under `public/data/`. The bundles are
regenerable — they're gitignored — so nothing in `public/data/` is hand-edited.

Each source module under `data-prep/phogra_data_prep/sources/` exposes the
same three-function interface:

```python
fetch(cache_dir: Path) -> Path      # download raw data (cached)
parse(raw_path: Path) -> Any        # parse to an intermediate form
emit(parsed, out_dir: Path) -> None # write JSON bundles
```

Adding a new source = drop a module in `sources/`, register it in
`cli.py`'s `SOURCES` dict.

### Registered sources

| Source | Status | Provides | License |
|--------|--------|----------|---------|
| **PHOIBLE 2.0** | ✅ M0 | Phoneme inventories (2094 languages) + distinctive features | CC BY-SA 3.0 |
| **Wikimedia Commons** | ⏳ M1 | Phoneme-level audio (OGG) | CC / PD |
| **WikiPron** | ⏳ M3 | Grapheme↔phoneme word pairs (~165 languages) | Apache 2.0 (code) / CC BY-SA (data) |
| **Glottolog** | ⏳ later | Language family, coordinates | CC BY 4.0 |

### Attributions (required)

- **PHOIBLE 2.0** — Moran, S. & McCloy, D. (eds.). 2019. *PHOIBLE 2.0*. Jena: Max Planck Institute for the Science of Human History. https://phoible.org/
- **WikiPron** — Lee, Jackson L. et al. "Massively Multilingual Pronunciation Modeling with WikiPron." LREC 2020.
- **Wikimedia Commons** recordings — individual contributors, see each file's page for attribution.
- **Glottolog 5** — Hammarström, H. et al. *Glottolog 5.0*. Leipzig: MPI-EVA. https://glottolog.org/

## Architecture

```
data-prep/           Python (uv) — sources + orchestrator
public/data/         Generated JSON (gitignored, regenerable)
src/
  schemas/           Zod schemas — SSOT for all on-disk formats, TS types inferred
  lib/               IPA utils, feature formatting, alignment (v1), data facade
  hooks/             useLanguage, useInventory, useAudio, useIpaChart
  store/             zustand slices (languages, selection, audio, ui)
  features/          lang-list, chart, phoneme-detail, graph-view
  components/        presentational primitives
  routes/            /, /lang/:iso, /lang/:iso/phoneme/:symbol, /lang/:iso/compare/:other
```

Design principles: progressive disclosure, composition over inheritance,
schema-first (every on-disk JSON validated with Zod on load), plugin-shaped
data sources.

## Known limitations

- **Multiple inventories per ISO** — PHOIBLE often has several inventories per
  language (e.g. English has ~5). M0 picks the largest; future milestones will
  expose the choice in the UI.
- **Language metadata is thin** — family, coordinates, macroarea are `null`
  until the Glottolog source adapter lands.
- **Phoneme-level audio is approximate** — Wikimedia Commons recordings are
  language-agnostic (e.g. "voiceless bilabial plosive"). For phoneme-in-context
  audio, future work can integrate Common Phone (6 languages, 116h aligned).

## License

Code: MIT (to be confirmed). Data bundles inherit their source licenses —
see Attributions above. Each emitted JSON carries its source in the `source`
field.
