from __future__ import annotations

import os


def resolve_rag_engine_mode() -> str:
    raw = (os.getenv("RAG_ENGINE_MODE") or "self").strip().lower()
    return "langchain" if raw == "langchain" else "self"
