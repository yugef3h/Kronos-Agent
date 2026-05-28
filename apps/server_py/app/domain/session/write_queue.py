from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

from app.domain.session.errors import SessionConflictError
from app.domain.session.types import Session

logger = logging.getLogger(__name__)

SaveHandler = Callable[[str, Session], Awaitable[Session]]

_queues: dict[str, asyncio.Task[None]] = {}


def enqueue_session_save(session_id: str, session: Session, save: SaveHandler) -> None:
    previous = _queues.get(session_id)

    async def run() -> None:
        if previous is not None:
            try:
                await previous
            except Exception:
                pass
        try:
            saved = await save(session_id, session)
            session.version = saved.version
            session.messages = list(saved.messages)
        except SessionConflictError:
            raise
        except Exception as error:
            reason = str(error) or "unknown error"
            logger.warning("[sessionStore] async save failed for %s: %s", session_id, reason)

    task = asyncio.create_task(run())
    _queues[session_id] = task

    def cleanup(done: asyncio.Task[None]) -> None:
        if _queues.get(session_id) is done:
            _queues.pop(session_id, None)

    task.add_done_callback(cleanup)


async def flush_session_save_queue(session_id: str) -> None:
    pending = _queues.get(session_id)
    if pending is not None:
        await pending
