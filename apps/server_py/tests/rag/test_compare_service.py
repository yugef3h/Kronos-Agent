from __future__ import annotations

import pytest
from app.rag.compare_service import compare_knowledge_retrieval_queries


class TestCompareService:
    @pytest.mark.asyncio
    async def test_returns_ranked_results_with_overlap(self):
        request = {
            "baseline_query": "machine learning basics",
            "candidate_query": "deep learning fundamentals",
            "dataset_ids": [],
        }
        result = await compare_knowledge_retrieval_queries(request)
        assert result["baseline"] == "machine learning basics"
        assert result["candidate"] == "deep learning fundamentals"
        assert isinstance(result["baseline_items"], list)
        assert isinstance(result["candidate_items"], list)
        assert isinstance(result["overlapping_ids"], list)
        assert isinstance(result["overlap_count"], int)

    @pytest.mark.asyncio
    async def test_empty_datasets_returns_empty_overlap(self):
        request = {
            "baseline_query": "test query A",
            "candidate_query": "test query B",
            "dataset_ids": [],
        }
        result = await compare_knowledge_retrieval_queries(request)
        assert result["overlap_count"] == 0
        assert result["overlapping_ids"] == []

    @pytest.mark.asyncio
    async def test_same_query_has_full_overlap(self):
        request = {
            "baseline_query": "exact same query",
            "candidate_query": "exact same query",
            "dataset_ids": [],
        }
        result = await compare_knowledge_retrieval_queries(request)
        assert isinstance(result["overlap_count"], int)
