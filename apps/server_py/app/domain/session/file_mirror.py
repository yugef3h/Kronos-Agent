from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from app.domain.session.normalize import parse_stored_session
from app.domain.session.session_paths import SESSIONS_DIR
from app.domain.session.types import Session

logger = logging.getLogger(__name__)


def session_file_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"


async def read_session_from_file(session_id: str) -> Session | None:
    path = session_file_path(session_id)
    try:
        raw = await asyncio.to_thread(path.read_text, encoding="utf-8")
        return parse_stored_session(json.loads(raw), __import__("time").time() * 1000)
    except OSError:
        return None
    except (json.JSONDecodeError, ValueError):
        return None


async def mirror_session_to_file(session_id: str, session: Session) -> None:
    try:
        await asyncio.to_thread(SESSIONS_DIR.mkdir, parents=True, exist_ok=True)
        path = session_file_path(session_id)
        payload = session.model_dump_json()
        await asyncio.to_thread(path.write_text, payload, encoding="utf-8")
    except OSError as error:
        logger.warning("[sessionStore] mirror session %s to file failed: %s", session_id, error)
