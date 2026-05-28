from __future__ import annotations

import asyncio
import os
import time
from typing import Awaitable, Callable, Optional

from app.config import get_settings
from app.domain.session.errors import SessionStreamLockBusyError
from app.domain.session.get_repository import resolve_session_store_mode
from app.infra.redis_client import get_redis_client

LOCK_KEY_PREFIX = "kronos:session:lock:"
DEFAULT_LOCK_TTL_SEC = 120

ReleaseLock = Callable[[], Awaitable[None]]


def _is_stream_lock_enabled() -> bool:
    if resolve_session_store_mode() != "redis":
        return False
    raw = (get_settings().session_stream_lock or "true").strip().lower()
    return raw not in ("false", "0", "no")


def _resolve_lock_ttl_sec() -> int:
    raw = get_settings().session_stream_lock_ttl_sec
    return raw if raw > 0 else DEFAULT_LOCK_TTL_SEC


async def acquire_session_stream_lock(session_id: str) -> Optional[ReleaseLock]:
    if not _is_stream_lock_enabled():
        return None

    client = get_redis_client()
    key = f"{LOCK_KEY_PREFIX}{session_id}"
    token = f"{os.getpid()}-{time.time()}"
    acquired = await client.set(key, token, ex=_resolve_lock_ttl_sec(), nx=True)

    if not acquired:
        raise SessionStreamLockBusyError(session_id)

    async def release() -> None:
        current = await client.get(key)
        if current == token:
            await client.delete(key)

    return release
