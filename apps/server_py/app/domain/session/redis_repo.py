from __future__ import annotations

import asyncio
import json
import logging

import redis.asyncio as redis
from redis.exceptions import WatchError

from app.config import get_settings
from app.domain.session.errors import SessionConflictError
from app.domain.session.file_mirror import mirror_session_to_file, read_session_from_file
from app.domain.session.migrate import migrate_session_files_to_redis
from app.domain.session.normalize import create_empty_session, normalize_session, parse_stored_session
from app.domain.session.session_keys import to_session_redis_key
from app.domain.session.types import Session

logger = logging.getLogger(__name__)
MAX_SAVE_RETRIES = 3


class RedisSessionRepository:
    def __init__(self, client: redis.Redis, ttl_sec: int) -> None:
        self._redis = client
        self._ttl_sec = ttl_sec

    async def init(self) -> None:
        try:
            await self._redis.ping()
            logger.warning("[sessionStore:redis] connected")
            await migrate_session_files_to_redis(self._redis, self._ttl_sec)
        except Exception as error:
            logger.warning("[sessionStore:redis] ping/migrate failed: %s", error)

    async def load(self, session_id: str) -> Session:
        key = to_session_redis_key(session_id)
        raw = await self._redis.get(key)

        if raw:
            try:
                return parse_stored_session(json.loads(raw), __import__("time").time() * 1000)
            except (json.JSONDecodeError, ValueError):
                return create_empty_session()

        from_file = await read_session_from_file(session_id)
        if from_file is None or (
            len(from_file.messages) == 0 and not from_file.memorySummary.strip()
        ):
            return create_empty_session()

        asyncio.create_task(self._lazy_migrate(session_id, from_file))
        return from_file.model_copy(deep=True)

    async def _lazy_migrate(self, session_id: str, session: Session) -> None:
        try:
            await self.save(session_id, session, expected_version=session.version)
        except Exception as error:
            reason = str(error) or "unknown error"
            logger.warning("[sessionStore:redis] lazy migrate %s failed: %s", session_id, reason)

    async def save(
        self,
        session_id: str,
        session: Session,
        *,
        expected_version: int | None = None,
    ) -> Session:
        key = to_session_redis_key(session_id)
        expected = session.version if expected_version is None else expected_version

        for _ in range(MAX_SAVE_RETRIES):
            async with self._redis.pipeline(transaction=True) as pipe:
                try:
                    await pipe.watch(key)
                    raw = await self._redis.get(key)
                    current = (
                        parse_stored_session(json.loads(raw), __import__("time").time() * 1000)
                        if raw
                        else create_empty_session()
                    )

                    if expected != current.version:
                        await pipe.unwatch()
                        raise SessionConflictError(session_id, expected, current.version)

                    next_session = normalize_session(
                        session.model_copy(update={"version": current.version + 1}),
                        __import__("time").time() * 1000,
                    )
                    pipe.multi()
                    pipe.set(key, next_session.model_dump_json(), ex=self._ttl_sec)
                    executed = await pipe.execute()
                except WatchError:
                    continue

                if executed:
                    if get_settings().session_file_mirror_enabled:
                        asyncio.create_task(mirror_session_to_file(session_id, next_session))
                    return next_session.model_copy(deep=True)

        raise SessionConflictError(session_id, expected, -1)
