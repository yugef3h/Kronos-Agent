from __future__ import annotations

import asyncio
from pathlib import Path

from app.domain.session.session_paths import SESSIONS_DIR
from app.domain.session.types import Session

_locks: dict[str, asyncio.Lock] = {}


def session_file_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


def _lock_for(session_id: str) -> asyncio.Lock:
    lock = _locks.get(session_id)
    if lock is None:
        lock = asyncio.Lock()
        _locks[session_id] = lock
    return lock


async def write_session_file(session_id: str, session: Session) -> None:
    async with _lock_for(session_id):
        await asyncio.to_thread(SESSIONS_DIR.mkdir, parents=True, exist_ok=True)
        final_path = session_file_path(session_id)
        tmp_path = final_path.with_suffix(".json.tmp")
        payload = session.model_dump_json()
        await asyncio.to_thread(tmp_path.write_text, payload, encoding="utf-8")
        await asyncio.to_thread(tmp_path.replace, final_path)
