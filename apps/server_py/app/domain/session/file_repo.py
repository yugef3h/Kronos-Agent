from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from app.domain.session.errors import SessionConflictError
from app.domain.session.normalize import create_empty_session, normalize_session, parse_stored_session
from app.domain.session.session_paths import SESSIONS_DIR
from app.domain.session.types import Session

logger = logging.getLogger(__name__)


class FileSessionRepository:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    async def init(self) -> None:
        try:
            await asyncio.to_thread(SESSIONS_DIR.mkdir, parents=True, exist_ok=True)
            paths = await asyncio.to_thread(lambda: list(SESSIONS_DIR.glob("*.json")))
            loaded = 0
            for path in paths:
                session_id = path.stem
                try:
                    raw = await asyncio.to_thread(path.read_text, encoding="utf-8")
                    stat = await asyncio.to_thread(path.stat)
                    data = parse_stored_session(json.loads(raw), stat.st_mtime * 1000)
                    self._sessions[session_id] = data
                    loaded += 1
                except (OSError, json.JSONDecodeError, ValueError):
                    logger.warning("[sessionStore] skip corrupt session file: %s", path.name)
            logger.warning("[sessionStore:file] loaded %s sessions", loaded)
        except OSError as error:
            logger.warning("[sessionStore:file] init failed: %s", error)

    def get_session_sync(self, session_id: str) -> Session:
        return self._sessions.get(session_id) or create_empty_session()

    async def load(self, session_id: str) -> Session:
        existing = self._sessions.get(session_id)
        if existing is not None:
            return existing.model_copy(deep=True)
        created = create_empty_session()
        self._sessions[session_id] = created
        return created.model_copy(deep=True)

    async def save(
        self,
        session_id: str,
        session: Session,
        *,
        expected_version: int | None = None,
    ) -> Session:
        current = self._sessions.get(session_id) or create_empty_session()
        expected = session.version if expected_version is None else expected_version

        if expected != current.version:
            raise SessionConflictError(session_id, expected, current.version)

        next_session = normalize_session(
            session.model_copy(update={"version": current.version + 1}),
            __import__("time").time() * 1000,
        )
        self._sessions[session_id] = next_session

        async def write_file() -> None:
            try:
                await asyncio.to_thread(SESSIONS_DIR.mkdir, parents=True, exist_ok=True)
                path: Path = SESSIONS_DIR / f"{session_id}.json"
                await asyncio.to_thread(
                    path.write_text,
                    next_session.model_dump_json(),
                    encoding="utf-8",
                )
            except OSError as error:
                logger.warning("[sessionStore:file] persist session %s failed: %s", session_id, error)

        asyncio.create_task(write_file())
        return next_session.model_copy(deep=True)
