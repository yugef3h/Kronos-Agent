from __future__ import annotations

import json
from pathlib import Path

from app.rag.document_types import KnowledgeDatasetChunkRecord
from app.rag.paths import resolve_knowledge_datasets_dir


def list_dataset_chunks(dataset_id: str) -> list[KnowledgeDatasetChunkRecord]:
    chunks_path = resolve_knowledge_datasets_dir() / dataset_id / "chunks.jsonl"
    if not chunks_path.exists():
        return []

    records: list[KnowledgeDatasetChunkRecord] = []
    try:
        for line in chunks_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            parsed = json.loads(line)
            if isinstance(parsed, dict):
                records.append(parsed)  # type: ignore[arg-type]
    except OSError:
        return []

    return records
