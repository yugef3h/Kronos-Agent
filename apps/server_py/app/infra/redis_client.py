from __future__ import annotations

from typing import Optional

import redis.asyncio as redis

from app.config import get_settings

_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    global _client
    if _client is None:
        settings = get_settings()
        url = (settings.redis_url or "").strip()
        if not url:
            raise RuntimeError("REDIS_URL is required when SESSION_STORE=redis")
        _client = redis.from_url(url, decode_responses=True)
    return _client


async def close_redis_client() -> None:
    global _client
    if _client is None:
        return
    await _client.aclose()
    _client = None
