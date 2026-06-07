"""Knowledge retrieval facade — mirrors apps/server/src/rag/knowledgeFacade.ts."""

from __future__ import annotations

import logging
from typing import Optional

from app.rag.dataset_store import list_knowledge_datasets
from app.rag.document_store import list_dataset_chunks
from app.rag.engine import bm25_search, hybrid_search, semantic_search
from app.rag.metadata_filter import matches_metadata_filter
from app.rag.query_types import (
    KnowledgeMetadataCondition,
    KnowledgeMultiRetrievalConfig,
    KnowledgeRetrievalQuery,
    KnowledgeSingleRetrievalConfig,
)
from app.rag.types import RetrievalDiagnostics, RetrievalItem, RetrievalQueryResult

logger = logging.getLogger(__name__)


def _enrich_chunk_item(
    chunk: dict,
    dataset_id: str,
    score: float,
    search_method: str,
    matched_terms: Optional[list[str]] = None,
) -> RetrievalItem:
    return {
        "dataset_id": dataset_id,
        "dataset_name": chunk.get("dataset_name", ""),
        "document_id": chunk.get("document_id", ""),
        "document_name": chunk.get("document_name", ""),
        "chunk_id": chunk.get("id") or chunk.get("chunk_id", ""),
        "chunk_index": chunk.get("index", 0),
        "text": chunk.get("text", ""),
        "score": round(score, 6),
        "search_method": search_method,
        "matched_terms": matched_terms or [],
        "metadata": chunk.get("metadata", {}),
        "token_count": chunk.get("tokenCount", 0),
        "char_count": chunk.get("charCount", 0),
    }


def _collect_chunks_for_datasets(
    dataset_ids: list[str],
    metadata_conditions: Optional[list[KnowledgeMetadataCondition]] = None,
) -> list[dict]:
    """Collect chunks from all specified datasets, optionally filtering by metadata."""
    all_chunks: list[dict] = []
    for ds_id in dataset_ids:
        chunks = list_dataset_chunks(ds_id)
        for chunk in chunks:
            chunk["_dataset_id"] = ds_id
        if metadata_conditions:
            chunks = [
                c for c in chunks
                if matches_metadata_filter(c.get("metadata", {}), metadata_conditions)
            ]
        all_chunks.extend(chunks)
    return all_chunks


async def run_knowledge_retrieval_query(
    query: KnowledgeRetrievalQuery,
    *,
    query_embedding: Optional[list[float]] = None,
    chunk_embeddings: Optional[list[tuple[dict, list[float]]]] = None,
) -> RetrievalQueryResult:
    """Execute a knowledge retrieval query using the configured strategy.

    Supports oneWay (single) and multiWay (hybrid) retrieval modes with
    optional metadata filtering.
    """
    dataset_ids = query.get("dataset_ids", [])
    retrieval_mode = query.get("retrieval_mode", "multiWay")
    metadata_conditions = query.get("metadata_filtering_conditions", [])
    query_text = query.get("query", "")

    if not query_text.strip():
        return RetrievalQueryResult(
            query=query_text,
            items=[],
            diagnostics=RetrievalDiagnostics(
                retrieval_mode=retrieval_mode,
                dataset_count=len(dataset_ids),
                total_chunk_count=0,
                filtered_chunk_count=0,
                query_variants=[],
            ),
        )

    chunks = _collect_chunks_for_datasets(dataset_ids, metadata_conditions or None)
    total_chunks = sum(
        len(list_dataset_chunks(ds_id)) for ds_id in dataset_ids
    ) if dataset_ids else 0

    diagnostics = RetrievalDiagnostics(
        retrieval_mode=retrieval_mode,
        dataset_count=len(dataset_ids),
        total_chunk_count=total_chunks,
        filtered_chunk_count=len(chunks),
        query_variants=[query_text],
    )

    if not chunks:
        return RetrievalQueryResult(query=query_text, items=[], diagnostics=diagnostics)

    items: list[RetrievalItem] = []

    if retrieval_mode == "oneWay":
        single_config = query.get("single_retrieval_config", {})
        top_k = single_config.get("top_k", 5)
        threshold = single_config.get("score_threshold")

        results = bm25_search(query_text, chunks, top_k=top_k, score_threshold=threshold)
        for chunk, score in results:
            ds_id = chunk.get("_dataset_id", dataset_ids[0] if dataset_ids else "")
            items.append(_enrich_chunk_item(chunk, ds_id, score, "bm25"))

    else:
        multi_config = query.get("multiple_retrieval_config", {})
        top_k = multi_config.get("top_k", 5)
        threshold = multi_config.get("score_threshold")

        results = hybrid_search(
            query_text,
            chunks,
            query_embedding=query_embedding,
            chunk_embeddings=chunk_embeddings,
            top_k=top_k,
            bm25_threshold=threshold,
            semantic_threshold=threshold,
        )
        for chunk, score in results:
            ds_id = chunk.get("_dataset_id", dataset_ids[0] if dataset_ids else "")
            items.append(_enrich_chunk_item(chunk, ds_id, score, "hybrid"))

    logger.info(
        "RAG retrieval query=%s mode=%s datasets=%d chunks=%d results=%d",
        query_text[:80],
        retrieval_mode,
        len(dataset_ids),
        len(chunks),
        len(items),
    )

    return RetrievalQueryResult(query=query_text, items=items, diagnostics=diagnostics)
