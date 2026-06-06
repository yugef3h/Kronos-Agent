from __future__ import annotations

from typing import TypedDict


class KnowledgeRetrievalCompareRequest(TypedDict):
    baseline_query: str
    candidate_query: str
    dataset_ids: list[str]


class KnowledgeRetrievalEvalCase(TypedDict, total=False):
    query: str
    expected_chunk_ids: list[str]


class KnowledgeRetrievalEvalRequest(TypedDict):
    cases: list[KnowledgeRetrievalEvalCase]
    dataset_ids: list[str]
    top_k: int
