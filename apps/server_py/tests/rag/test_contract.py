import pytest

from app.rag.contract import assert_knowledge_retrieval_query_result_contract


def test_contract_raises_on_missing_keys():
    with pytest.raises(ValueError):
        assert_knowledge_retrieval_query_result_contract({"query": "q", "items": []})
