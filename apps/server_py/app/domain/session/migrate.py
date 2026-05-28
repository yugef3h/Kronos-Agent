from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

import redis.asyncio as redis

from app.domain.session.normalize import parse_stored_session
from app.domain.session.session_keys import to_session_redis_key
from app.domain.session.session_paths import SESSIONS_DIR

logger = logging.getLogger(__name__)


async def migrate_session_files_to_redis(client: redis.Redis, ttl_sec: int) -> int:
    migrated = 0

    try:
        paths = await asyncio.to_thread(lambda: list(SESSIONS_DIR.glob("*.json")))
    except OSError as error:
        logger.warning("[sessionStore:redis] file migration scan failed: %s", error)
        return 0

    for path in paths:
        session_id = path.stem
        key = to_session_redis_key(session_id)
        if await client.exists(key):
            continue

        try:
            raw = await asyncio.to_thread(path.read_text, encoding="utf-8")
            stat = await asyncio.to_thread(path.stat)
            session = parse_stored_session(json.loads(raw), stat.st_mtime * 1000)
            await client.set(key, session.model_dump_json(), ex=ttl_sec)
            migrated += 1
        except (OSError, json.JSONDecodeError, ValueError):
            logger.warning(
                "[sessionStore:redis] skip corrupt session file during migrate: %s",
                path.name,
            )

    if migrated > 0:
        logger.warning("[sessionStore:redis] migrated %s sessions from file to redis", migrated)

    return migrated
