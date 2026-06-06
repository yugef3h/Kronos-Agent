from app.rag.document_store import list_dataset_chunks


def test_document_store_returns_empty_chunks(tmp_path, monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_DATASETS_DIR", str(tmp_path))
    assert list_dataset_chunks("ds_missing") == []
