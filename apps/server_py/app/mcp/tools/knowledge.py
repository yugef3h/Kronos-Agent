"""MCP tool: knowledge_search — query local RAG knowledge base."""

from __future__ import annotations

from app.mcp.server import register_tool


async def _handle_knowledge_search(arguments: dict) -> dict:
    """Search the local knowledge base using RAG retrieval."""
    query = arguments.get("query", "")
    dataset_ids = arguments.get("dataset_ids", [])
    top_k = arguments.get("top_k", 5)

    if not query.strip():
        return {"error": "query is required", "results": []}

    try:
        from app.rag.facade import run_knowledge_retrieval_query
        result = await run_knowledge_retrieval_query({
            "query": query,
            "dataset_ids": dataset_ids,
            "retrieval_mode": "multiWay",
            "single_retrieval_config": {"model": "default-vector", "top_k": top_k, "score_threshold": None},
            "multiple_retrieval_config": {"top_k": top_k, "score_threshold": None, "reranking_enable": False, "reranking_model": ""},
            "metadata_filtering_mode": "disabled",
            "metadata_filtering_conditions": [],
        })

        return {
            "query": query,
            "results": [
                {
                    "chunk_id": item.get("chunk_id"),
                    "dataset": item.get("dataset_name"),
                    "text": item.get("text", "")[:300],
                    "score": item.get("score"),
                    "source": item.get("document_name"),
                }
                for item in result.get("items", [])
            ],
            "total_found": len(result.get("items", [])),
            "diagnostics": result.get("diagnostics", {}),
        }
    except NotImplementedError:
        return {"error": "RAG facade not available", "results": [], "total_found": 0}
    except Exception as exc:
        return {"error": str(exc), "results": [], "total_found": 0}


def register() -> None:
    register_tool(
        name="knowledge_search",
        description="Search the Kronos local knowledge base using hybrid (BM25 + semantic) retrieval",
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query text"},
                "dataset_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Dataset IDs to search",
                },
                "top_k": {"type": "integer", "description": "Number of results", "default": 5},
            },
            "required": ["query"],
        },
        handler=_handle_knowledge_search,
    )
