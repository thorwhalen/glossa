"""Orchestrator CLI.

Runs each registered source adapter in turn:

    phogra-data-prep all        # fetch + parse + emit for every source
    phogra-data-prep phoible    # run just one source
"""
from __future__ import annotations

from pathlib import Path

import argh

from .sources import phoible, wikipron

# Registry: source_name -> module with fetch/parse/emit
SOURCES = {
    "phoible": phoible,
    "wikipron": wikipron,
}


def _resolve_paths(
    cache_dir: str | None, out_dir: str | None
) -> tuple[Path, Path]:
    # Default layout: data-prep/cache/ and ../public/data/
    here = Path(__file__).resolve().parent.parent  # data-prep/
    cache = Path(cache_dir) if cache_dir else here / "cache"
    out = Path(out_dir) if out_dir else here.parent / "public" / "data"
    cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    return cache, out


def run_one(
    source: str, *, cache_dir: str | None = None, out_dir: str | None = None
):
    """Run a single source adapter (fetch → parse → emit)."""
    if source not in SOURCES:
        raise SystemExit(
            f"unknown source '{source}'. available: {', '.join(SOURCES)}"
        )
    cache, out = _resolve_paths(cache_dir, out_dir)
    mod = SOURCES[source]
    print(f"[{source}] fetch → {cache}")
    raw = mod.fetch(cache)
    print(f"[{source}] parse  {raw}")
    parsed = mod.parse(raw)
    print(f"[{source}] emit  → {out}")
    mod.emit(parsed, out)
    print(f"[{source}] done")


def run_all(*, cache_dir: str | None = None, out_dir: str | None = None):
    """Run every registered source adapter."""
    for name in SOURCES:
        run_one(name, cache_dir=cache_dir, out_dir=out_dir)


def main():
    argh.dispatch_commands([run_one, run_all])


if __name__ == "__main__":
    main()
