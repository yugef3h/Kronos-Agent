from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class SingleRetrievalConfigSchema(BaseModel):
    model: str
    top_k: int = Field(ge=1)
    score_threshold: float | None = None


class MultiRetrievalConfigSchema(BaseModel):
    top_k: int = Field(ge=1)
    score_threshold: float | None = None
    reranking_enable: bool = False
    reranking_model: str | None = None


class MetadataConditionSchema(BaseModel):
    id: str | None = None
    field: str
    operator: Literal["contains", "equals", "not_equals"] = "contains"
    value: str


class KnowledgeRetrievalQuerySchema(BaseModel):
    query: str
    dataset_ids: list[str]
    retrieval_mode: Literal["oneWay", "multiWay"] = "multiWay"
    single_retrieval_config: SingleRetrievalConfigSchema
    multiple_retrieval_config: MultiRetrievalConfigSchema
    metadata_filtering_mode: Literal["disabled", "manual"] = "disabled"
    metadata_filtering_conditions: list[MetadataConditionSchema] = Field(default_factory=list)

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("query must not be empty")
        return value

    @field_validator("dataset_ids")
    @classmethod
    def dataset_ids_not_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("dataset_ids must not be empty")
        return value
