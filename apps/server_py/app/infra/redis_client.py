from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as redis

from app.config import get_settings

logger = logging.getLogger(__name__)
_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    """Return the shared async Redis client, creating it on first call.

    Raises RuntimeError if REDIS_URL is unset when SESSION_STORE=redis.
    """
    global _client
    if _client is None:
        settings = get_settings()
        url = (settings.redis_url or "").strip()
        if not url:
            raise RuntimeError("REDIS_URL is required when SESSION_STORE=redis")
        _client = redis.from_url(url, decode_responses=True)
    return _client


def is_redis_available() -> bool:
    """Return True if Redis client is initialized and (best-effort) reachable."""
    if _client is None:
        return False
    try:
        _client.ping()
        return True
    except Exception:
        return False


async def close_redis_client() -> None:
    """Close the shared Redis client gracefully, ignoring connection errors."""
    global _client
    if _client is None:
        return
    try:
        await _client.aclose()
    except Exception as exc:
        logger.warning("Error closing Redis client: %s", exc)
    finally:
        _client = None
