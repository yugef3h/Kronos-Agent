from __future__ import annotations

import math
import os
from collections import defaultdict
from typing import Optional

from app.rag.scoring import tokenize_for_bm25, cosine_similarity, merge_hybrid_scores
from app.rag.document_store import list_dataset_chunks
from app.rag.metadata_filter import matches_metadata_filter


def resolve_rag_engine_mode() -> str:
    raw = (os.getenv("RAG_ENGINE_MODE") or "self").strip().lower()
    return "langchain" if raw == "langchain" else "self"


def _compute_bm25_score(
    query_tokens: list[str],
    doc_tokens: list[str],
    doc_count: int,
    doc_freqs: dict[str, int],
    avg_doc_len: float,
    *,
    k1: float = 1.2,
    b: float = 0.75,
) -> float:
    """Compute BM25 score for a single document against query tokens."""
    if not query_tokens or not doc_tokens:
        return 0.0
    doc_len = len(doc_tokens)
    score = 0.0
    for token in set(query_tokens):
        qf = query_tokens.count(token)
        df = doc_freqs.get(token, 0)
        if df == 0:
            continue
        idf = math.log(1.0 + (doc_count - df + 0.5) / (df + 0.5))
        tf = doc_tokens.count(token)
        numerator = tf * (k1 + 1.0)
        denominator = tf + k1 * (1.0 - b + b * doc_len / max(avg_doc_len, 1.0))
        score += idf * qf * numerator / max(denominator, 0.001)
    return score


def bm25_search(
    query: str,
    chunks: list[dict],
    *,
    top_k: int = 10,
    score_threshold: Optional[float] = None,
) -> list[tuple[dict, float]]:
    """Rank chunks by BM25 score against query."""
    if not chunks or not query.strip():
        return []

    query_tokens = tokenize_for_bm25(query)
    if not query_tokens:
        return [(c, 1.0) for c in chunks[:top_k]]

    doc_tokens_list = [tokenize_for_bm25(c.get("text", "")) for c in chunks]
    doc_count = len(chunks)

    doc_freqs: dict[str, int] = defaultdict(int)
    for tokens in doc_tokens_list:
        for token in set(tokens):
            doc_freqs[token] += 1

    avg_doc_len = sum(len(t) for t in doc_tokens_list) / max(doc_count, 1)

    scored: list[tuple[dict, float]] = []
    for i, chunk in enumerate(chunks):
        score = _compute_bm25_score(
            query_tokens, doc_tokens_list[i], doc_count, doc_freqs, avg_doc_len
        )
        if score_threshold is not None and score < score_threshold:
            continue
        scored.append((chunk, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


def semantic_search(
    query_embedding: list[float],
    chunk_embeddings: list[tuple[dict, list[float]]],
    *,
    top_k: int = 10,
    score_threshold: Optional[float] = None,
) -> list[tuple[dict, float]]:
    """Rank chunks by cosine similarity between query and chunk embeddings."""
    if not chunk_embeddings or not query_embedding:
        return []

    scored: list[tuple[dict, float]] = []
    for chunk, emb in chunk_embeddings:
        sim = cosine_similarity(query_embedding, emb)
        if score_threshold is not None and sim < score_threshold:
            continue
        scored.append((chunk, sim))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


def hybrid_search(
    query: str,
    chunks: list[dict],
    *,
    query_embedding: Optional[list[float]] = None,
    chunk_embeddings: Optional[list[tuple[dict, list[float]]]] = None,
    top_k: int = 10,
    keyword_weight: float = 0.4,
    semantic_weight: float = 0.6,
    bm25_threshold: Optional[float] = None,
    semantic_threshold: Optional[float] = None,
) -> list[tuple[dict, float]]:
    """Combine BM25 keyword and semantic similarity search results."""
    bm25_results = bm25_search(query, chunks, top_k=top_k * 2, score_threshold=bm25_threshold)
    bm25_map: dict[str, float] = {}
    for chunk, score in bm25_results:
        chunk_id = chunk.get("id") or chunk.get("chunk_id", "")
        bm25_map[chunk_id] = score

    semantic_map: dict[str, float] = {}
    if query_embedding and chunk_embeddings:
        sem_results = semantic_search(
            query_embedding, chunk_embeddings, top_k=top_k * 2, score_threshold=semantic_threshold
        )
        for chunk, score in sem_results:
            chunk_id = chunk.get("id") or chunk.get("chunk_id", "")
            semantic_map[chunk_id] = score

    all_ids = set(bm25_map.keys()) | set(semantic_map.keys())
    merged: list[tuple[dict, float]] = []
    chunk_by_id: dict[str, dict] = {}
    for chunk, _ in bm25_results:
        chunk_by_id[chunk.get("id") or chunk.get("chunk_id", "")] = chunk
    if chunk_embeddings:
        for chunk, _ in chunk_embeddings:
            chunk_by_id[chunk.get("id") or chunk.get("chunk_id", "")] = chunk

    for chunk_id in all_ids:
        kw_score = bm25_map.get(chunk_id, 0.0)
        sem_score = semantic_map.get(chunk_id, 0.0)
        combined = merge_hybrid_scores(
            kw_score, sem_score, keyword_weight=keyword_weight, semantic_weight=semantic_weight
        )
        if chunk := chunk_by_id.get(chunk_id):
            merged.append((chunk, combined))

    merged.sort(key=lambda x: x[1], reverse=True)
    return merged[:top_k]
