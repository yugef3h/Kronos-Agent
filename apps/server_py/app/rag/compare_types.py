from __future__ import annotations

from typing import TypedDict


class KnowledgeRetrievalCompareRequest(TypedDict):
    baseline_query: str
    candidate_query: str
    dataset_ids: list[str]


class KnowledgeRetrievalCompareResult(TypedDict):
    baseline: str
    candidate: str
    baseline_items: list[dict]
    candidate_items: list[dict]
    overlapping_ids: list[str]
    overlap_count: int


class KnowledgeRetrievalEvalCase(TypedDict, total=False):
    query: str
    dataset_ids: list[str]
    gold_chunk_ids: list[str]
    expected_answer: str
    top_k: int


class KnowledgeRetrievalEvalRequest(TypedDict):
    query_cases: list[KnowledgeRetrievalEvalCase]


class KnowledgeRetrievalEvalQueryResult(TypedDict, total=False):
    query: str
    retrieved_ids: list[str]
    recall_at_k: float
    mrr: float
    em: float
    f1: float
    error: str


class KnowledgeRetrievalEvalResult(TypedDict):
    query_results: list[KnowledgeRetrievalEvalQueryResult]
    summary: dict
