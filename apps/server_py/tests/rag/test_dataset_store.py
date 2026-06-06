from app.rag.dataset_store import list_knowledge_datasets


def test_dataset_store_returns_empty_when_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_DATASETS_STORE_PATH", str(tmp_path / "missing.json"))
    assert list_knowledge_datasets() == []
