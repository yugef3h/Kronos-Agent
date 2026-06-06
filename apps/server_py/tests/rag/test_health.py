from app.rag.health import check_rag_data_health


def test_health_reports_missing_datasets_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("KNOWLEDGE_DATASETS_DIR", str(tmp_path / "missing"))
    monkeypatch.setenv("KNOWLEDGE_DATASETS_STORE_PATH", str(tmp_path / "store.json"))
    health = check_rag_data_health()
    assert health["datasets_dir_exists"] is False
    assert health["store_exists"] is False
