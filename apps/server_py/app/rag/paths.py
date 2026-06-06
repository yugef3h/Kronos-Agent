from __future__ import annotations

import os
from pathlib import Path

SERVER_PY_ROOT = Path(__file__).resolve().parent.parent.parent
APPS_ROOT = SERVER_PY_ROOT.parent
DEFAULT_SERVER_DATA = APPS_ROOT / "server" / "data"


def resolve_knowledge_datasets_dir() -> Path:
    raw = os.getenv("KNOWLEDGE_DATASETS_DIR", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return (DEFAULT_SERVER_DATA / "knowledge-datasets").resolve()


def resolve_knowledge_datasets_store_path() -> Path:
    raw = os.getenv("KNOWLEDGE_DATASETS_STORE_PATH", "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return (DEFAULT_SERVER_DATA / "knowledge-datasets.json").resolve()
