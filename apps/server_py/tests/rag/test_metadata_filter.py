from app.rag.metadata_filter import matches_metadata_filter


def test_metadata_contains_filter_passes():
    metadata = {"source": "internal wiki", "lang": "zh"}
    conditions = [{"field": "source", "operator": "contains", "value": "wiki"}]
    assert matches_metadata_filter(metadata, conditions) is True
