import os

from app.rag.engine import resolve_rag_engine_mode


def test_engine_mode_defaults_self(monkeypatch):
    monkeypatch.delenv("RAG_ENGINE_MODE", raising=False)
    assert resolve_rag_engine_mode() == "self"


def test_engine_mode_langchain(monkeypatch):
    monkeypatch.setenv("RAG_ENGINE_MODE", "langchain")
    assert resolve_rag_engine_mode() == "langchain"
