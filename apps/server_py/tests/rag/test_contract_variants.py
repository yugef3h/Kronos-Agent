from app.rag.contract import assert_knowledge_retrieval_query_result_contract


def test_contract_accepts_query_variants_in_diagnostics():
    result = {
        "query": "hello",
        "items": [],
        "diagnostics": {
            "retrieval_mode": "multiWay",
            "dataset_count": 0,
            "total_chunk_count": 0,
            "filtered_chunk_count": 0,
            "query_variants": 2,
        },
    }
    assert_knowledge_retrieval_query_result_contract(result)
