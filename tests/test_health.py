"""``/health`` reports whether the data is there, and never leaks a filesystem path."""

import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient

SERVER = Path(__file__).resolve().parents[1] / "server.py"


def _client(monkeypatch, data_root):
    """Load glossa's own server.py by path (a bare ``import server`` can find another app's)."""
    monkeypatch.setenv("GLOSSA_APP_DATA_DIR", str(data_root))
    spec = importlib.util.spec_from_file_location("glossa_server", SERVER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return TestClient(module.app)


def test_health_ok_without_a_path(tmp_path, monkeypatch):
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "languages.json").write_text("[]")
    body = _client(monkeypatch, tmp_path).get("/health").json()
    assert body == {"ok": True, "has_languages_index": True}
    assert str(tmp_path) not in str(body)


def test_health_not_ok_when_the_index_is_missing(tmp_path, monkeypatch):
    body = _client(monkeypatch, tmp_path).get("/health").json()
    assert body["ok"] is False
    assert str(tmp_path) not in str(body)
