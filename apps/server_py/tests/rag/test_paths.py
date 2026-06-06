from app.rag.paths import resolve_knowledge_datasets_dir, resolve_knowledge_datasets_store_path


def test_paths_default_to_server_data_root():
    datasets_dir = resolve_knowledge_datasets_dir()
    store_path = resolve_knowledge_datasets_store_path()
    assert datasets_dir.name == "knowledge-datasets"
    assert store_path.name == "knowledge-datasets.json"
    assert "server" in str(datasets_dir)
    assert "data" in str(store_path)
