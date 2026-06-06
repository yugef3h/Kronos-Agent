from __future__ import annotations

import pytest


@pytest.fixture
def sample_prompt() -> str:
    return "今天有什么科技新闻？"


@pytest.fixture
def sample_rag_query() -> dict:
    return {
        "query": "contract test",
        "dataset_ids": ["ds_demo"],
        "retrieval_mode": "multiWay",
        "single_retrieval_config": {"model": "default-vector", "top_k": 3, "score_threshold": None},
        "multiple_retrieval_config": {
            "top_k": 5,
            "score_threshold": None,
            "reranking_enable": False,
        },
        "metadata_filtering_mode": "disabled",
        "metadata_filtering_conditions": [],
    }


@pytest.fixture
def sample_retrieval_result() -> dict:
    return {
        "query": "contract test",
        "items": [],
        "diagnostics": {
            "retrieval_mode": "multiWay",
            "dataset_count": 0,
            "total_chunk_count": 0,
            "filtered_chunk_count": 0,
        },
    }
