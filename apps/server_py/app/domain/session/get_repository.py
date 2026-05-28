from __future__ import annotations

from typing import Literal, Optional, Protocol

from app.config import get_settings
from app.domain.session.file_repo import FileSessionRepository
from app.domain.session.redis_repo import RedisSessionRepository
from app.domain.session.types import Session
from app.infra.redis_client import get_redis_client

SessionStoreMode = Literal["file", "redis"]

_repository: Optional[FileSessionRepository | RedisSessionRepository] = None
_file_repository: Optional[FileSessionRepository] = None


class SessionRepository(Protocol):
    async def init(self) -> None: ...
    async def load(self, session_id: str) -> Session: ...
    async def save(
        self,
        session_id: str,
        session: Session,
        *,
        expected_version: int | None = None,
    ) -> Session: ...


def resolve_session_store_mode() -> SessionStoreMode:
    raw = get_settings().session_store.strip().lower()
    return "redis" if raw == "redis" else "file"


def get_session_repository() -> SessionRepository:
    global _repository, _file_repository
    if _repository is not None:
        return _repository

    if resolve_session_store_mode() == "redis":
        settings = get_settings()
        _repository = RedisSessionRepository(get_redis_client(), settings.session_ttl_sec)
        return _repository

    _file_repository = FileSessionRepository()
    _repository = _file_repository
    return _repository


def get_file_session_repository_or_null() -> FileSessionRepository | None:
    return _file_repository
