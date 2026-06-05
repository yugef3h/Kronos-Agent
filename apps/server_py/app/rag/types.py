from __future__ import annotations

from typing import Any, TypedDict


class RetrievalDiagnostics(TypedDict, total=False):
    retrieval_mode: str
    dataset_count: int
    total_chunk_count: int
    filtered_chunk_count: int
    query_variants: list[str]


class RetrievalItem(TypedDict, total=False):
    dataset_id: str
    dataset_name: str
    document_id: str
    document_name: str
    chunk_id: str
    chunk_index: int
    text: str
    score: float
    search_method: str
    matched_terms: list[str]
    metadata: dict[str, Any]
    token_count: int
    char_count: int


class RetrievalQueryResult(TypedDict):
    query: str
    items: list[RetrievalItem]
    diagnostics: RetrievalDiagnostics
