from __future__ import annotations

import asyncio
import json
import logging

from app.domain.session.normalize import parse_stored_session
from app.domain.session.types import Session
from app.domain.session.write_session_file import session_file_path, write_session_file

logger = logging.getLogger(__name__)


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
        await write_session_file(session_id, session)
    except OSError as error:
        logger.warning("[sessionStore] mirror session %s to file failed: %s", session_id, error)
