from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from app.rag.dataset_types import KnowledgeDatasetRecord
from app.rag.paths import resolve_knowledge_datasets_dir, resolve_knowledge_datasets_store_path
from app.rag.document_store import list_dataset_chunks

logger = logging.getLogger(__name__)


def list_knowledge_datasets() -> list[KnowledgeDatasetRecord]:
    """List all available knowledge datasets from the store file."""
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


def get_dataset_by_id(dataset_id: str) -> Optional[KnowledgeDatasetRecord]:
    """Find a single dataset by its ID."""
    for ds in list_knowledge_datasets():
        if ds.get("id") == dataset_id:
            return ds
    return None


def count_dataset_chunks(dataset_id: str) -> int:
    """Count chunks in a dataset by reading its chunks.jsonl."""
    chunks = list_dataset_chunks(dataset_id)
    return len(chunks)


def resolve_dataset_dir(dataset_id: str) -> Path:
    """Resolve the data directory for a specific dataset."""
    return resolve_knowledge_datasets_dir() / dataset_id


def dataset_exists(dataset_id: str) -> bool:
    """Check if a dataset directory and its chunks file exist."""
    ds_dir = resolve_dataset_dir(dataset_id)
    chunks_path = ds_dir / "chunks.jsonl"
    return ds_dir.exists() and chunks_path.exists()


def get_dataset_stats(dataset_id: str) -> dict:
    """Return statistics for a dataset."""
    ds_dir = resolve_dataset_dir(dataset_id)
    chunks_path = ds_dir / "chunks.jsonl"
    meta_path = ds_dir / "dataset.json"

    stats = {
        "dataset_id": dataset_id,
        "exists": ds_dir.exists(),
        "chunks_file_exists": chunks_path.exists(),
        "chunk_count": 0,
        "chunks_size_bytes": 0,
        "metadata_exists": meta_path.exists(),
    }

    if chunks_path.exists():
        stats["chunk_count"] = count_dataset_chunks(dataset_id)
        try:
            stats["chunks_size_bytes"] = chunks_path.stat().st_size
        except OSError:
            pass

    return stats


def search_datasets_by_name(name_fragment: str) -> list[KnowledgeDatasetRecord]:
    """Case-insensitive partial name search across datasets."""
    fragment = name_fragment.lower()
    return [
        ds for ds in list_knowledge_datasets()
        if fragment in (ds.get("name", "") or "").lower()
    ]
