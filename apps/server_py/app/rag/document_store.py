from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from app.rag.document_types import KnowledgeDatasetChunkRecord
from app.rag.paths import resolve_knowledge_datasets_dir

logger = logging.getLogger(__name__)


def list_dataset_chunks(dataset_id: str) -> list[KnowledgeDatasetChunkRecord]:
    """Read all chunks for a dataset from its chunks.jsonl file."""
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


def get_chunk_by_id(dataset_id: str, chunk_id: str) -> Optional[KnowledgeDatasetChunkRecord]:
    """Find a single chunk by ID within a dataset."""
    for chunk in list_dataset_chunks(dataset_id):
        if chunk.get("id") == chunk_id or chunk.get("chunk_id") == chunk_id:
            return chunk
    return None


def count_chunks_total(dataset_id: str) -> int:
    """Count total chunks without loading all into memory."""
    chunks_path = resolve_knowledge_datasets_dir() / dataset_id / "chunks.jsonl"
    if not chunks_path.exists():
        return 0
    try:
        text = chunks_path.read_text(encoding="utf-8")
        return sum(1 for line in text.splitlines() if line.strip())
    except OSError:
        return 0


def list_documents_in_dataset(dataset_id: str) -> list[str]:
    """List unique document IDs in a dataset's chunks."""
    doc_ids: set[str] = set()
    for chunk in list_dataset_chunks(dataset_id):
        doc_id = chunk.get("document_id") or chunk.get("documentId", "")
        if doc_id:
            doc_ids.add(doc_id)
    return sorted(doc_ids)


def get_dataset_chunk_stats(dataset_id: str) -> dict:
    """Return aggregate statistics for chunks in a dataset."""
    chunks = list_dataset_chunks(dataset_id)
    if not chunks:
        return {"dataset_id": dataset_id, "chunk_count": 0, "total_tokens": 0, "total_chars": 0}

    token_counts = [c.get("tokenCount", 0) for c in chunks if isinstance(c.get("tokenCount"), (int, float))]
    char_counts = [c.get("charCount", 0) for c in chunks if isinstance(c.get("charCount"), (int, float))]

    return {
        "dataset_id": dataset_id,
        "chunk_count": len(chunks),
        "total_tokens": sum(token_counts),
        "total_chars": sum(char_counts),
        "avg_tokens_per_chunk": round(sum(token_counts) / len(token_counts), 1) if token_counts else 0,
        "avg_chars_per_chunk": round(sum(char_counts) / len(char_counts), 1) if char_counts else 0,
        "unique_documents": len(list_documents_in_dataset(dataset_id)),
    }
