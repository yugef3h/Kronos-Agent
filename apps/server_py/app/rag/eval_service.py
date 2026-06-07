from __future__ import annotations

import logging
from typing import Optional

from app.rag.compare_types import (
    KnowledgeRetrievalEvalRequest,
    KnowledgeRetrievalEvalResult,
    KnowledgeRetrievalEvalQueryResult,
    KnowledgeRetrievalEvalCase,
)
from app.rag.facade import run_knowledge_retrieval_query
from app.rag.metrics import recall_at_k, mean_reciprocal_rank

logger = logging.getLogger(__name__)


def _compute_em_score(predicted_answer: str, expected_answer: str) -> float:
    """Exact match after whitespace normalization."""
    pred = " ".join(predicted_answer.strip().split())
    exp = " ".join(expected_answer.strip().split())
    return 1.0 if pred.lower() == exp.lower() else 0.0


def _compute_f1_score(predicted_answer: str, expected_answer: str) -> float:
    """Character-level F1 ignoring whitespace differences."""
    pred_chars = set(predicted_answer.replace(" ", ""))
    exp_chars = set(expected_answer.replace(" ", ""))
    if not pred_chars or not exp_chars:
        return 0.0
    tp = len(pred_chars & exp_chars)
    precision = tp / len(pred_chars) if pred_chars else 0.0
    recall = tp / len(exp_chars) if exp_chars else 0.0
    if precision + recall == 0.0:
        return 0.0
    return 2.0 * precision * recall / (precision + recall)


async def evaluate_knowledge_retrieval_run(
    request: KnowledgeRetrievalEvalRequest,
) -> KnowledgeRetrievalEvalResult:
    """Run evaluation across multiple queries, computing recall@k, MRR, EM, F1.

    Each query case specifies a query, dataset IDs, gold chunk IDs, and
    optionally an expected answer for EM/F1 scoring.
    """
    query_cases = request.get("query_cases", [])
    if not query_cases:
        return KnowledgeRetrievalEvalResult(
            query_results=[],
            summary={"total_queries": 0, "avg_recall_at_5": 0.0, "avg_mrr": 0.0},
        )

    query_results: list[KnowledgeRetrievalEvalQueryResult] = []
    recalls: list[float] = []
    mrrs: list[float] = []

    for case in query_cases:
        query_text = case.get("query", "")
        gold_ids = set(case.get("gold_chunk_ids", []))
        expected = case.get("expected_answer", "")
        top_k = case.get("top_k", 5)
        dataset_ids = case.get("dataset_ids", [])

        try:
            retrieval_result = await run_knowledge_retrieval_query({
                "query": query_text,
                "dataset_ids": dataset_ids,
                "retrieval_mode": "multiWay",
                "single_retrieval_config": {"model": "default-vector", "top_k": top_k, "score_threshold": None},
                "multiple_retrieval_config": {"top_k": top_k, "score_threshold": None, "reranking_enable": False, "reranking_model": ""},
                "metadata_filtering_mode": "disabled",
                "metadata_filtering_conditions": [],
            })
        except Exception as exc:
            logger.warning("Eval query failed for '%s': %s", query_text[:80], exc)
            query_results.append(KnowledgeRetrievalEvalQueryResult(
                query=query_text,
                retrieved_ids=[],
                recall_at_k=0.0,
                mrr=0.0,
                em=0.0,
                f1=0.0,
                error=str(exc)[:200],
            ))
            recalls.append(0.0)
            mrrs.append(0.0)
            continue

        retrieved_ids = [item.get("chunk_id", "") for item in retrieval_result.get("items", [])]
        r_at_k = recall_at_k(gold_ids, retrieved_ids, top_k)
        mrr_val = mean_reciprocal_rank(gold_ids, retrieved_ids)

        em = 0.0
        f1 = 0.0
        if expected:
            predicted_answer = " ".join(
                item.get("text", "") for item in retrieval_result.get("items", [])[:3]
            )
            em = _compute_em_score(predicted_answer, expected)
            f1 = _compute_f1_score(predicted_answer, expected)

        recalls.append(r_at_k)
        mrrs.append(mrr_val)

        query_results.append(KnowledgeRetrievalEvalQueryResult(
            query=query_text,
            retrieved_ids=retrieved_ids,
            recall_at_k=r_at_k,
            mrr=mrr_val,
            em=em,
            f1=f1,
        ))

    total = len(query_results)
    summary = {
        "total_queries": total,
        "avg_recall_at_5": round(sum(recalls) / total, 4) if total else 0.0,
        "avg_mrr": round(sum(mrrs) / total, 4) if total else 0.0,
        "queries_with_errors": sum(1 for r in query_results if r.get("error")),
    }

    logger.info(
        "RAG eval complete: %d queries, avg_recall=%.4f, avg_mrr=%.4f",
        total, summary["avg_recall_at_5"], summary["avg_mrr"],
    )

    return KnowledgeRetrievalEvalResult(query_results=query_results, summary=summary)
