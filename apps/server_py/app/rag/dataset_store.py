from __future__ import annotations

import json
from pathlib import Path

from app.rag.dataset_types import KnowledgeDatasetRecord
from app.rag.paths import resolve_knowledge_datasets_store_path


def list_knowledge_datasets() -> list[KnowledgeDatasetRecord]:
    store_path = resolve_knowledge_datasets_store_path()
    if not store_path.exists():
        return []

    try:
        raw = json.loads(store_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    datasets = raw.get("datasets") if isinstance(raw, dict) else raw
    if not isinstance(datasets, list):
        return []

    return [item for item in datasets if isinstance(item, dict)]
