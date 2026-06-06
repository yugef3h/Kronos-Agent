from __future__ import annotations

from typing import Any, TypedDict


class KnowledgeDatasetChunkRecord(TypedDict, total=False):
    dataset_id: str
    document_id: str
    document_name: str
    chunk_id: str
    chunk_index: int
    text: str
    metadata: dict[str, str]
    token_count: int
    char_count: int
    embedding: list[float]


class KnowledgePreviewChunk(TypedDict):
    id: str
    index: int
    text: str
    tokenCount: int
    charCount: int


class KnowledgePreviewItem(TypedDict):
    fileName: str
    mimeType: str
    totalChunks: int
    preview: list[KnowledgePreviewChunk]


class KnowledgeImportResult(TypedDict, total=False):
    document_id: str
    chunk_count: int
    dataset_id: str
