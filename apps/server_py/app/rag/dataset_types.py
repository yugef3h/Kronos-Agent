from __future__ import annotations

from typing import Any, TypedDict


class KnowledgeDatasetRecord(TypedDict, total=False):
    id: str
    name: str
    description: str
    is_multimodal: bool
    doc_metadata: list[dict[str, Any]]
    created_at: str
    updated_at: str
    version: int
