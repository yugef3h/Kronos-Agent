from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class SingleRetrievalConfigSchema(BaseModel):
    model: str
    top_k: int = Field(ge=1, le=100)
    score_threshold: float | None = Field(default=None, ge=0.0, le=1.0)

    @field_validator("model")
    @classmethod
    def model_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("model must not be empty")
        return value


class MultiRetrievalConfigSchema(BaseModel):
    top_k: int = Field(ge=1, le=100)
    score_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    reranking_enable: bool = False
    reranking_model: str | None = None

    @field_validator("reranking_model")
    @classmethod
    def reranking_model_when_enabled(cls, value: str | None, info) -> str | None:
        if info.data.get("reranking_enable") and not value:
            raise ValueError("reranking_model required when reranking_enable is true")
        return value


class MetadataConditionSchema(BaseModel):
    id: str | None = None
    field: str
    operator: Literal["contains", "equals", "not_equals"] = "contains"
    value: str

    @field_validator("field")
    @classmethod
    def field_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("field must not be empty")
        return value


class KnowledgeRetrievalQuerySchema(BaseModel):
    query: str
    dataset_ids: list[str]
    retrieval_mode: Literal["oneWay", "multiWay"] = "multiWay"
    single_retrieval_config: SingleRetrievalConfigSchema | None = None
    multiple_retrieval_config: MultiRetrievalConfigSchema | None = None
    metadata_filtering_mode: Literal["disabled", "manual"] = "disabled"
    metadata_filtering_conditions: list[MetadataConditionSchema] = Field(default_factory=list)

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("query must not be empty")
        stripped = value.strip()
        if len(stripped) > 2000:
            raise ValueError("query must not exceed 2000 characters")
        return stripped

    @field_validator("dataset_ids")
    @classmethod
    def dataset_ids_not_empty(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("dataset_ids must not be empty")
        if len(value) > 50:
            raise ValueError("dataset_ids must not exceed 50 entries")
        return [ds_id.strip() for ds_id in value if ds_id.strip()]

    @model_validator(mode="after")
    def validate_mode_config(self):
        if self.retrieval_mode == "oneWay" and self.single_retrieval_config is None:
            raise ValueError("single_retrieval_config required for oneWay mode")
        if self.retrieval_mode == "multiWay" and self.multiple_retrieval_config is None:
            raise ValueError("multiple_retrieval_config required for multiWay mode")
        return self


class KnowledgeRetrievalEvalRequestSchema(BaseModel):
    query_cases: list[dict] = Field(min_length=1, max_length=200)

    @field_validator("query_cases")
    @classmethod
    def validate_cases(cls, value: list[dict]) -> list[dict]:
        for i, case in enumerate(value):
            if not isinstance(case.get("query"), str) or not case["query"].strip():
                raise ValueError(f"query_cases[{i}].query must be a non-empty string")
            gold_ids = case.get("gold_chunk_ids", [])
            if not isinstance(gold_ids, list):
                raise ValueError(f"query_cases[{i}].gold_chunk_ids must be a list")
        return value


class KnowledgeRetrievalCompareRequestSchema(BaseModel):
    baseline_query: str = Field(min_length=1, max_length=2000)
    candidate_query: str = Field(min_length=1, max_length=2000)
    dataset_ids: list[str] = Field(min_length=1, max_length=50)
