"""Knowledge node executor — RAG retrieval from configured datasets."""

from __future__ import annotations

import logging
import time
from typing import AsyncIterator

from app.workflow.fsm import NodeState

logger = logging.getLogger(__name__)


async def execute_knowledge_node(
    node_state: NodeState,
    node_config: dict,
    upstream_output: dict,
) -> AsyncIterator[dict]:
    """Execute a Knowledge node — perform retrieval from selected datasets."""
    node_state.transition_to("RUNNING")
    node_state.started_at = time.time()

    dataset_ids = node_config.get("dataset_ids", [])
    query_source = node_config.get("query_source", "upstream")
    top_k = int(node_config.get("top_k", 5))
    retrieval_mode = node_config.get("retrieval_mode", "multiWay")
    fixed_query = node_config.get("query", "")

    query = fixed_query if fixed_query else (
        upstream_output.get("last_response", "") or
        upstream_output.get("input", {}).get("prompt", "")
    )

    yield {
        "type": "node_start",
        "node_id": node_state.node_id,
        "node_type": "knowledge",
        "stage": "plan",
        "status": "info",
        "message": f"Knowledge retrieval: datasets={dataset_ids} top_k={top_k} mode={retrieval_mode}",
        "timestamp": int(time.time() * 1000),
    }

    items: list[dict] = []
    knowledge_context = ""
    error_occurred = False

    try:
        from app.rag.facade import run_knowledge_retrieval_query
        result = await run_knowledge_retrieval_query({
            "query": query,
            "dataset_ids": dataset_ids,
            "retrieval_mode": retrieval_mode,
            "single_retrieval_config": {"model": "default-vector", "top_k": top_k, "score_threshold": None},
            "multiple_retrieval_config": {"top_k": top_k, "score_threshold": None, "reranking_enable": False, "reranking_model": ""},
            "metadata_filtering_mode": node_config.get("metadata_filtering_mode", "disabled"),
            "metadata_filtering_conditions": node_config.get("metadata_filtering_conditions", []),
        })
        items = result.get("items", [])
        knowledge_context = "\n\n".join(
            f"[{item.get('dataset_name', '')}] {item.get('text', '')}"
            for item in items
        )

        chunk_count = len(items)
        yield {
            "type": "timeline",
            "node_id": node_state.node_id,
            "stage": "reason",
            "status": "info",
            "message": f"Retrieved {chunk_count} chunks from {len(dataset_ids)} dataset(s)",
            "timestamp": int(time.time() * 1000),
            "chunk_count": chunk_count,
        }

    except NotImplementedError:
        knowledge_context = f"[RAG facade pending — query: {query[:100]}]"
        items = [{"text": knowledge_context, "chunk_id": "fallback"}]
    except Exception as exc:
        logger.error("Knowledge node %s failed: %s", node_state.node_id, exc)
        node_state.error = str(exc)[:500]
        node_state.transition_to("FAILED")
        node_state.completed_at = time.time()
        error_occurred = True
        yield {
            "type": "node_end",
            "node_id": node_state.node_id,
            "node_type": "knowledge",
            "status": "FAILED",
            "error": node_state.error,
            "timestamp": int(time.time() * 1000),
        }

    if not error_occurred:
        node_state.output = {
            "items": items,
            "knowledge_context": knowledge_context,
            "chunk_count": len(items),
            "query": query,
        }
        node_state.transition_to("SUCCESS")
        node_state.completed_at = time.time()

        yield {
            "type": "node_end",
            "node_id": node_state.node_id,
            "node_type": "knowledge",
            "status": "SUCCESS",
            "timestamp": int(time.time() * 1000),
            "output": node_state.output,
        }
