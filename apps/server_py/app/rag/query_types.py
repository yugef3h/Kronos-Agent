from __future__ import annotations

from typing import Literal, TypedDict


class KnowledgeSingleRetrievalConfig(TypedDict):
    model: str
    top_k: int
    score_threshold: float | None


class KnowledgeMultiRetrievalConfig(TypedDict):
    top_k: int
    score_threshold: float | None
    reranking_enable: bool
    reranking_model: str


class KnowledgeMetadataCondition(TypedDict, total=False):
    id: str
    field: str
    operator: Literal["contains", "equals", "not_equals"]
    value: str


class KnowledgeRetrievalQuery(TypedDict):
    query: str
    dataset_ids: list[str]
    retrieval_mode: Literal["oneWay", "multiWay"]
    single_retrieval_config: KnowledgeSingleRetrievalConfig
    multiple_retrieval_config: KnowledgeMultiRetrievalConfig
    metadata_filtering_mode: Literal["disabled", "manual"]
    metadata_filtering_conditions: list[KnowledgeMetadataCondition]
