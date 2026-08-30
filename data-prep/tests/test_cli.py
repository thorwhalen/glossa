"""The CLI's parsing surface: which commands exist and which flags they take.

These are pure parser tests — nothing is fetched, parsed, or emitted.
"""
from __future__ import annotations

import pytest

from glossa_data_prep.cli import _make_parser, main


@pytest.mark.parametrize(
    "argv, expected",
    [
        (["run-one", "phoible"], {"source": "phoible", "cache_dir": None, "out_dir": None}),
        (
            ["run-one", "phoible", "-c", "/c", "-o", "/o"],
            {"source": "phoible", "cache_dir": "/c", "out_dir": "/o"},
        ),
        (
            ["run-one", "phoible", "--cache-dir", "/c", "--out-dir", "/o"],
            {"source": "phoible", "cache_dir": "/c", "out_dir": "/o"},
        ),
        (["run-all"], {"cache_dir": None, "out_dir": None}),
        (["run-all", "-o", "/o"], {"cache_dir": None, "out_dir": "/o"}),
    ],
)
def test_parses_the_documented_surface(argv, expected):
    parsed = vars(_make_parser().parse_args(argv))
    assert {k: parsed[k] for k in expected} == expected


@pytest.mark.parametrize("argv", [[], ["run-one"], ["nope"]])
def test_rejects_incomplete_invocations(argv):
    with pytest.raises(SystemExit):
        _make_parser().parse_args(argv)


def test_dispatches_to_the_named_command(monkeypatch):
    calls = []
    monkeypatch.setattr(
        "glossa_data_prep.cli.run_one", lambda **kw: calls.append(("run-one", kw))
    )
    monkeypatch.setattr(
        "glossa_data_prep.cli.run_all", lambda **kw: calls.append(("run-all", kw))
    )
    main(["run-one", "phoible", "-o", "/o"])
    main(["run-all", "-c", "/c"])
    assert calls == [
        ("run-one", {"source": "phoible", "cache_dir": None, "out_dir": "/o"}),
        ("run-all", {"cache_dir": "/c", "out_dir": None}),
    ]


def test_unknown_source_is_a_clean_exit():
    from glossa_data_prep.cli import run_one

    with pytest.raises(SystemExit, match="unknown source"):
        run_one("not-a-source")
