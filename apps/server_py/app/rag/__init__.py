"""Wave 2 — knowledge retrieval domain (migration from apps/server/src/rag)."""

from app.rag.contract import (
    assert_knowledge_preview_item_contract,
    assert_knowledge_retrieval_query_result_contract,
)
from app.rag.engine import (
    resolve_rag_engine_mode,
    bm25_search,
    hybrid_search,
    semantic_search,
)
from app.rag.eval import char_level_f1
from app.rag.facade import run_knowledge_retrieval_query
from app.rag.health import check_rag_data_health
from app.rag.metrics import recall_at_k, mean_reciprocal_rank
from app.rag.paths import resolve_knowledge_datasets_dir, resolve_knowledge_datasets_store_path
from app.rag.embedding_cache import (
    load_cached_embedding,
    save_embedding_to_cache,
    batch_load_cached_embeddings,
    embedding_cache_stats,
)

__all__ = [
    "assert_knowledge_preview_item_contract",
    "assert_knowledge_retrieval_query_result_contract",
    "batch_load_cached_embeddings",
    "bm25_search",
    "char_level_f1",
    "check_rag_data_health",
    "embedding_cache_stats",
    "hybrid_search",
    "load_cached_embedding",
    "mean_reciprocal_rank",
    "recall_at_k",
    "resolve_knowledge_datasets_dir",
    "resolve_knowledge_datasets_store_path",
    "resolve_rag_engine_mode",
    "run_knowledge_retrieval_query",
    "save_embedding_to_cache",
    "semantic_search",
]
