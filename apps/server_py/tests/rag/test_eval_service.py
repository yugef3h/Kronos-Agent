from __future__ import annotations

import pytest
from app.rag.eval_service import evaluate_knowledge_retrieval_run


class TestEvalService:
    @pytest.mark.asyncio
    async def test_computes_metrics_from_gold_chunks(self):
        request = {
            "query_cases": [
                {
                    "query": "test",
                    "dataset_ids": [],
                    "gold_chunk_ids": [],
                    "expected_answer": "",
                    "top_k": 5,
                }
            ]
        }
        result = await evaluate_knowledge_retrieval_run(request)
        assert "query_results" in result
        assert "summary" in result
        assert result["summary"]["total_queries"] == 1

    @pytest.mark.asyncio
    async def test_empty_cases_returns_zero_summary(self):
        request = {"query_cases": []}
        result = await evaluate_knowledge_retrieval_run(request)
        assert result["summary"]["total_queries"] == 0
        assert result["summary"]["avg_recall_at_5"] == 0.0
        assert result["summary"]["avg_mrr"] == 0.0

    @pytest.mark.asyncio
    async def test_handles_query_errors_gracefully(self):
        request = {
            "query_cases": [
                {
                    "query": "valid query",
                    "dataset_ids": ["nonexistent_ds"],
                    "gold_chunk_ids": ["g1"],
                    "expected_answer": "",
                    "top_k": 5,
                }
            ]
        }
        result = await evaluate_knowledge_retrieval_run(request)
        assert result["summary"]["total_queries"] == 1
        assert len(result["query_results"]) == 1
        # Should complete without exception even for missing dataset
        assert isinstance(result["query_results"][0].get("recall_at_k"), float)
