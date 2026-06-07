from __future__ import annotations

import logging

from app.rag.compare_types import (
    KnowledgeRetrievalCompareRequest,
    KnowledgeRetrievalCompareResult,
)
from app.rag.facade import run_knowledge_retrieval_query

logger = logging.getLogger(__name__)


async def compare_knowledge_retrieval_queries(
    request: KnowledgeRetrievalCompareRequest,
) -> KnowledgeRetrievalCompareResult:
    """Compare retrieval results between a baseline and candidate query.

    Runs both queries against the same datasets and computes overlap
    between the result sets (by chunk_id).
    """
    baseline_query = request.get("baseline_query", "")
    candidate_query = request.get("candidate_query", "")
    dataset_ids = request.get("dataset_ids", [])

    query_config = {
        "retrieval_mode": "multiWay",
        "single_retrieval_config": {"model": "default-vector", "top_k": 10, "score_threshold": None},
        "multiple_retrieval_config": {"top_k": 10, "score_threshold": None, "reranking_enable": False, "reranking_model": ""},
        "metadata_filtering_mode": "disabled",
        "metadata_filtering_conditions": [],
    }

    baseline_result = await run_knowledge_retrieval_query({
        "query": baseline_query,
        "dataset_ids": dataset_ids,
        **query_config,  # type: ignore[typeddict-item]
    })

    candidate_result = await run_knowledge_retrieval_query({
        "query": candidate_query,
        "dataset_ids": dataset_ids,
        **query_config,  # type: ignore[typeddict-item]
    })

    baseline_ids = {item.get("chunk_id", "") for item in baseline_result.get("items", [])}
    candidate_ids = {item.get("chunk_id", "") for item in candidate_result.get("items", [])}
    overlapping = sorted(baseline_ids & candidate_ids)

    logger.info(
        "RAG compare baseline=%s candidate=%s overlap=%d",
        baseline_query[:60], candidate_query[:60], len(overlapping),
    )

    return KnowledgeRetrievalCompareResult(
        baseline=baseline_query,
        candidate=candidate_query,
        baseline_items=list(baseline_result.get("items", [])),
        candidate_items=list(candidate_result.get("items", [])),
        overlapping_ids=overlapping,
        overlap_count=len(overlapping),
    )
