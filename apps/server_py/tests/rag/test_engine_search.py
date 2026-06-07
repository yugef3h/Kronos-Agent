from __future__ import annotations

from app.rag.engine import bm25_search, hybrid_search


class TestBm25Search:
    def test_returns_scored_chunks_for_relevant_query(self):
        chunks = [
            {"id": "c1", "text": "Python is a programming language for AI development"},
            {"id": "c2", "text": "Cooking pasta requires boiling water and salt"},
            {"id": "c3", "text": "Machine learning with Python uses libraries like PyTorch"},
        ]
        results = bm25_search("Python AI machine learning", chunks, top_k=3)
        assert len(results) > 0
        assert results[0][0]["id"] in ("c3", "c1")

    def test_respects_top_k_limit(self):
        chunks = [{"id": f"c{i}", "text": f"document chunk number {i} about various topics"} for i in range(20)]
        results = bm25_search("document", chunks, top_k=5)
        assert len(results) == 5

    def test_empty_chunks_returns_empty(self):
        results = bm25_search("test query", [], top_k=10)
        assert results == []

    def test_empty_query_returns_empty(self):
        chunks = [{"id": "c1", "text": "some content"}]
        results = bm25_search("   ", chunks, top_k=10)
        assert results == []

    def test_score_threshold_filters_results(self):
        chunks = [
            {"id": "c1", "text": "irrelevant cooking recipes"},
            {"id": "c2", "text": "another unrelated text"},
        ]
        results = bm25_search("quantum physics", chunks, top_k=5, score_threshold=0.5)
        assert len(results) <= 1


class TestHybridSearch:
    def test_merges_keyword_and_semantic_scores(self):
        chunks = [
            {"id": "c1", "text": "Python programming language for AI"},
            {"id": "c2", "text": "Cooking Italian pasta recipes"},
            {"id": "c3", "text": "Machine learning with Python"},
        ]
        query_embedding = [0.1, 0.2, 0.3]
        chunk_embeddings = [
            (chunks[0], [0.1, 0.2, 0.3]),
            (chunks[1], [0.8, 0.1, 0.1]),
            (chunks[2], [0.1, 0.2, 0.25]),
        ]
        results = hybrid_search(
            "Python AI",
            chunks,
            query_embedding=query_embedding,
            chunk_embeddings=chunk_embeddings,
            top_k=2,
        )
        assert len(results) <= 2

    def test_falls_back_to_keyword_when_no_embeddings(self):
        chunks = [
            {"id": "c1", "text": "Python AI development"},
            {"id": "c2", "text": "baking chocolate cake"},
        ]
        results = hybrid_search("Python", chunks, top_k=2)
        assert len(results) > 0
        assert results[0][0]["id"] == "c1"

    def test_returns_empty_for_no_chunks(self):
        results = hybrid_search("query", [], top_k=5)
        assert results == []
