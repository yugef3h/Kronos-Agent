from fastapi import FastAPI

from app.config import get_settings


def test_knowledge_route_absent_when_flag_disabled(monkeypatch):
    monkeypatch.setenv("RAG_ROUTES_ENABLED", "false")
    monkeypatch.setenv("JWT_SECRET", "test-secret-key-123456")
    monkeypatch.setenv("DOUBAO_API_KEY", "k")
    monkeypatch.setenv("DOUBAO_BASE_URL", "https://example.com")
    monkeypatch.setenv("DOUBAO_MODEL", "m")
    get_settings.cache_clear()

    from app.main import _register_optional_routers

    app = FastAPI()
    _register_optional_routers(app)
    paths = [getattr(route, "path", "") for route in app.routes]
    assert not any("knowledge-retrieval" in path for path in paths)

    get_settings.cache_clear()
