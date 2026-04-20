"""Source adapters.

Each source is a module exporting three callables:

    fetch(cache_dir)  - downloads raw data to cache_dir, returns the raw artifact path
    parse(raw_path)   - parses raw artifact to a canonical intermediate structure
    emit(parsed, out) - writes JSON bundles under `out`

The orchestrator wires sources together so a new source can be added by
dropping a module in this package and registering it in the CLI.
"""

from . import phoible  # noqa: F401
from . import wikipron  # noqa: F401
