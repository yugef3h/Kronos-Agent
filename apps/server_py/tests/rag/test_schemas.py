import pytest
from pydantic import ValidationError

from app.rag.schemas import KnowledgeRetrievalQuerySchema


def test_schema_rejects_empty_query_string():
    with pytest.raises(ValidationError):
        KnowledgeRetrievalQuerySchema(
            query="   ",
            dataset_ids=["ds1"],
            single_retrieval_config={"model": "m", "top_k": 3, "score_threshold": None},
            multiple_retrieval_config={
                "top_k": 5,
                "score_threshold": None,
                "reranking_enable": False,
            },
        )
