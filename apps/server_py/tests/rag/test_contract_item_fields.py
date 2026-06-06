import pytest

from app.rag.contract import assert_knowledge_retrieval_query_result_contract


def test_contract_matched_terms_must_be_array():
    result = {
        "query": "q",
        "items": [
            {
                "dataset_id": "d",
                "dataset_name": "n",
                "document_id": "doc",
                "document_name": "dn",
                "chunk_id": "c",
                "chunk_index": 0,
                "text": "t",
                "score": 1.0,
                "search_method": "keyword",
                "matched_terms": "bad",
                "metadata": {},
                "token_count": 1,
                "char_count": 1,
            }
        ],
        "diagnostics": {
            "retrieval_mode": "multiWay",
            "dataset_count": 1,
            "total_chunk_count": 1,
            "filtered_chunk_count": 1,
        },
    }
    with pytest.raises(ValueError, match="matched_terms"):
        assert_knowledge_retrieval_query_result_contract(result)


def test_contract_metadata_must_be_object():
    result = {
        "query": "q",
        "items": [
            {
                "dataset_id": "d",
                "dataset_name": "n",
                "document_id": "doc",
                "document_name": "dn",
                "chunk_id": "c",
                "chunk_index": 0,
                "text": "t",
                "score": 1.0,
                "search_method": "keyword",
                "matched_terms": [],
                "metadata": None,
                "token_count": 1,
                "char_count": 1,
            }
        ],
        "diagnostics": {
            "retrieval_mode": "multiWay",
            "dataset_count": 1,
            "total_chunk_count": 1,
            "filtered_chunk_count": 1,
        },
    }
    with pytest.raises(ValueError, match="metadata"):
        assert_knowledge_retrieval_query_result_contract(result)
