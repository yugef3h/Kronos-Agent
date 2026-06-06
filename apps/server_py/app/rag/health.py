from __future__ import annotations

from app.rag.paths import resolve_knowledge_datasets_dir, resolve_knowledge_datasets_store_path


def check_rag_data_health() -> dict[str, object]:
    datasets_dir = resolve_knowledge_datasets_dir()
    store_path = resolve_knowledge_datasets_store_path()
    return {
        "datasets_dir": str(datasets_dir),
        "datasets_dir_exists": datasets_dir.exists(),
        "store_path": str(store_path),
        "store_exists": store_path.exists(),
    }
