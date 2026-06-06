def test_rag_query_fixture(sample_rag_query):
    assert sample_rag_query["query"] == "contract test"
    assert sample_rag_query["dataset_ids"] == ["ds_demo"]
