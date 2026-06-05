from __future__ import annotations

from app.rag.types import RetrievalQueryResult

RETRIEVAL_ITEM_KEYS = (
    "dataset_id",
    "dataset_name",
    "document_id",
    "document_name",
    "chunk_id",
    "chunk_index",
    "text",
    "score",
    "search_method",
    "matched_terms",
    "metadata",
    "token_count",
    "char_count",
)


def assert_knowledge_retrieval_query_result_contract(result: RetrievalQueryResult) -> None:
    if not isinstance(result.get("query"), str):
        raise ValueError("contract: result.query must be string")
    if not isinstance(result.get("items"), list):
        raise ValueError("contract: result.items must be array")

    diagnostics = result.get("diagnostics")
    if not isinstance(diagnostics, dict):
        raise ValueError("contract: result.diagnostics missing")

    for key in ("retrieval_mode", "dataset_count", "total_chunk_count", "filtered_chunk_count"):
        if key not in diagnostics:
            raise ValueError(f"contract: diagnostics.{key} missing")

    for item in result["items"]:
        for key in RETRIEVAL_ITEM_KEYS:
            if key not in item:
                raise ValueError(f"contract: item missing {key}")
