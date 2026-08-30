"""Orchestrator CLI.

Runs each registered source adapter in turn:

    glossa-data-prep run-all              # fetch + parse + emit for every source
    glossa-data-prep run-one phoible      # run just one source
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from .sources import phoible, wikipron

# Registry: source_name -> module with fetch/parse/emit
SOURCES = {
    "phoible": phoible,
    "wikipron": wikipron,
}


#: Where the emitted bundles go by default. NOT ``../public/data`` any more: Vite copies
#: ``public/`` into the build, the build is mirrored to the server with ``rsync --delete``,
#: and these files are gitignored — so emitting there put ~110MB one clean checkout away
#: from being erased. The data root is outside the deploy-managed tree; ``server.py`` and
#: ``vite.config.ts`` both read the same location, and ``deploy.py cmd-push-data`` ships it.
#:
#: Override with ``--out-dir``, or point ``GLOSSA_APP_DATA_DIR`` at another root.
DATA_DIR_ENV = "GLOSSA_APP_DATA_DIR"


def default_out_dir() -> Path:
    """``~/.local/share/glossa/data`` — mirrors ``data_dir()`` in server.py."""
    override = os.environ.get(DATA_DIR_ENV)
    root = Path(override).expanduser() if override else Path.home() / ".local" / "share" / "glossa"
    return root / "data"


def _resolve_paths(
    cache_dir: str | None, out_dir: str | None
) -> tuple[Path, Path]:
    # Default layout: data-prep/cache/ and the data root (see default_out_dir).
    here = Path(__file__).resolve().parent.parent  # data-prep/
    cache = Path(cache_dir) if cache_dir else here / "cache"
    out = Path(out_dir) if out_dir else default_out_dir()
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


def _make_parser() -> argparse.ArgumentParser:
    """Build the ``glossa-data-prep`` parser.

    The ``"-"`` help placeholders are deliberate: they keep ``--help`` output
    byte-identical to the previous release.
    """
    parser = argparse.ArgumentParser(prog="glossa-data-prep")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_command(name, fn, *positionals):
        sp = sub.add_parser(name, help=fn.__doc__, description=fn.__doc__)
        for positional in positionals:
            sp.add_argument(positional, help="-")
        sp.add_argument("-c", "--cache-dir", default=None, help="-")
        sp.add_argument("-o", "--out-dir", default=None, help="-")
        sp.set_defaults(func=fn)

    add_command("run-one", run_one, "source")
    add_command("run-all", run_all)
    return parser


def main(argv=None):
    """Parse ``argv`` (default ``sys.argv[1:]``) and run the chosen command."""
    kwargs = vars(_make_parser().parse_args(argv))
    fn = kwargs.pop("func")
    kwargs.pop("command")
    fn(**kwargs)


if __name__ == "__main__":
    main()
