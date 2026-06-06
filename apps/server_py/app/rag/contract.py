from __future__ import annotations

from app.rag.document_types import KnowledgePreviewItem
from app.rag.types import RetrievalQueryResult

PREVIEW_CHUNK_KEYS = ("id", "index", "text", "tokenCount", "charCount")

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
        if not isinstance(item.get("matched_terms"), list):
            raise ValueError("contract: matched_terms must be array")
        metadata = item.get("metadata")
        if not isinstance(metadata, dict):
            raise ValueError("contract: metadata must be object")


def assert_knowledge_preview_item_contract(item: KnowledgePreviewItem) -> None:
    if not isinstance(item.get("fileName"), str):
        raise ValueError("contract: preview item.fileName")
    if not isinstance(item.get("mimeType"), str):
        raise ValueError("contract: preview item.mimeType")
    if not isinstance(item.get("totalChunks"), int):
        raise ValueError("contract: preview item.totalChunks")
    preview = item.get("preview")
    if not isinstance(preview, list):
        raise ValueError("contract: preview item.preview")

    for chunk in preview:
        if not isinstance(chunk, dict):
            raise ValueError("contract: preview chunk")
        for key in PREVIEW_CHUNK_KEYS:
            if key not in chunk:
                raise ValueError(f"contract: preview chunk missing {key}")
