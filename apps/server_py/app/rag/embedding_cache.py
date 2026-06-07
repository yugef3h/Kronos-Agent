from __future__ import annotations

import hashlib
import json
import logging
import os
import pickle
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

EMBEDDING_CACHE_TTL_SEC = int(os.getenv("EMBEDDING_CACHE_TTL_SEC", "86400") or "86400")


def _resolve_cache_dir() -> Path:
    raw = os.getenv("EMBEDDING_CACHE_DIR", "").strip()
    if raw:
        return Path(raw).expanduser()
    from app.rag.paths import resolve_knowledge_datasets_dir
    return resolve_knowledge_datasets_dir() / ".embedding_cache"


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


def _cache_path_for_hash(text_hash_val: str) -> Path:
    return _resolve_cache_dir() / f"{text_hash_val}.pickle"


def load_cached_embedding(text: str) -> Optional[list[float]]:
    """Load a cached embedding vector for the given text if fresh."""
    cache_path = _cache_path_for_hash(_text_hash(text))
    if not cache_path.exists():
        return None

    try:
        data = pickle.loads(cache_path.read_bytes())
    except (OSError, pickle.UnpicklingError, EOFError) as exc:
        logger.debug("embedding cache read failed for %s: %s", cache_path, exc)
        return None

    if not isinstance(data, dict):
        return None

    vector = data.get("v")
    if not isinstance(vector, list) or not all(isinstance(x, (int, float)) for x in vector):
        return None

    return [float(x) for x in vector]


def save_embedding_to_cache(text: str, vector: list[float]) -> None:
    """Persist an embedding vector to local pickle cache."""
    cache_dir = _resolve_cache_dir()
    cache_dir.mkdir(parents=True, exist_ok=True)

    cache_path = _cache_path_for_hash(_text_hash(text))
    payload = {"v": [float(x) for x in vector], "h": _text_hash(text)}
    try:
        cache_path.write_bytes(pickle.dumps(payload))
    except OSError as exc:
        logger.warning("embedding cache write failed for %s: %s", cache_path, exc)


def batch_load_cached_embeddings(texts: list[str]) -> dict[str, list[float]]:
    """Load cached embeddings for multiple texts. Returns map of text -> vector."""
    result: dict[str, list[float]] = {}
    for text in texts:
        vec = load_cached_embedding(text)
        if vec is not None:
            result[text] = vec
    return result


def clear_embedding_cache() -> int:
    """Remove all cached embedding files. Returns count of removed files."""
    cache_dir = _resolve_cache_dir()
    if not cache_dir.exists():
        return 0
    count = 0
    for entry in cache_dir.iterdir():
        if entry.suffix == ".pickle":
            try:
                entry.unlink()
                count += 1
            except OSError:
                pass
    return count


def embedding_cache_stats() -> dict:
    """Return cache directory statistics."""
    cache_dir = _resolve_cache_dir()
    if not cache_dir.exists():
        return {"cache_dir": str(cache_dir), "entry_count": 0, "exists": False}
    entries = list(cache_dir.glob("*.pickle"))
    total_bytes = sum(e.stat().st_size for e in entries if e.is_file())
    return {
        "cache_dir": str(cache_dir),
        "entry_count": len(entries),
        "total_bytes": total_bytes,
        "exists": True,
    }
