"""phogra data-prep pipeline.

Each source module under `sources/` exposes the plugin interface:

    fetch(cache_dir: Path) -> Path           # downloads, returns path to raw data
    parse(raw_path: Path) -> Any              # parses into a source-specific intermediate
    emit(parsed, out_dir: Path) -> None       # writes the app's JSON bundle format
"""
__version__ = "0.1.0"
