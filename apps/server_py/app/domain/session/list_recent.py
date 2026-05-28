from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from app.domain.session.get_repository import resolve_session_store_mode
from app.domain.session.normalize import parse_stored_session
from app.domain.session.session_keys import SESSION_REDIS_KEY_PREFIX, to_session_redis_key
from app.domain.session.session_paths import SESSIONS_DIR
from app.domain.session.types import PlaygroundHistorySurface, RecentDialogueItem, Session
from app.infra.redis_client import get_redis_client

logger = logging.getLogger(__name__)


def _parse_published_playground_stream_session_id(
    stream_session_id: str,
) -> Optional[tuple[str, str]]:
    marker = "-chatbot-"
    if not stream_session_id.startswith("playground-"):
        return None
    marker_index = stream_session_id.find(marker)
    if marker_index < 0:
        return None
    base_session_id = stream_session_id[len("playground-") : marker_index]
    workflow_app_id = stream_session_id[marker_index + len(marker) :]
    if not base_session_id or not workflow_app_id:
        return None
    return base_session_id, workflow_app_id


def _to_dialogue_item(session_id: str, session: Session, updated_at: float) -> Optional[RecentDialogueItem]:
    for message in reversed(session.messages):
        if message.role != "user":
            continue
        parsed = _parse_published_playground_stream_session_id(session_id)
        playground_surface: PlaygroundHistorySurface = "published" if parsed else "default"
        return RecentDialogueItem(
            id=session_id,
            sessionId=session_id,
            updatedAt=updated_at,
            userContent=message.content,
            playgroundSurface=playground_surface,
            basePlaygroundSessionId=parsed[0] if parsed else session_id,
            publishedChatbotWorkflowAppId=parsed[1] if parsed else None,
        )
    return None


def _resolve_updated_at(session: Session, fallback: float) -> float:
    message_times = [message.timestamp for message in session.messages if isinstance(message.timestamp, int)]
    if message_times:
        return float(max(message_times))
    if isinstance(session.memorySummaryUpdatedAt, int):
        return float(session.memorySummaryUpdatedAt)
    return fallback


async def list_recent_dialogues_from_files(limit: int) -> list[RecentDialogueItem]:
    dialogues: list[RecentDialogueItem] = []
    try:
        await asyncio.to_thread(SESSIONS_DIR.mkdir, parents=True, exist_ok=True)
        paths = await asyncio.to_thread(lambda: list(SESSIONS_DIR.glob("*.json")))
        for path in paths:
            try:
                raw = await asyncio.to_thread(path.read_text, encoding="utf-8")
                stat = await asyncio.to_thread(path.stat)
                session = parse_stored_session(json.loads(raw), stat.st_mtime * 1000)
                item = _to_dialogue_item(path.stem, session, stat.st_mtime * 1000)
                if item is not None:
                    dialogues.append(item)
            except (OSError, json.JSONDecodeError, ValueError):
                logger.warning("[sessionStore] skip unreadable session file: %s", path.name)
    except OSError as error:
        logger.warning("[sessionStore] list_recent_dialogues_from_files failed: %s", error)

    dialogues.sort(key=lambda item: item.updatedAt, reverse=True)
    return dialogues[:limit]


async def list_recent_dialogues_from_redis(limit: int) -> list[RecentDialogueItem]:
    client = get_redis_client()
    dialogues: list[RecentDialogueItem] = []
    cursor = 0

    while True:
        cursor, keys = await client.scan(
            cursor=cursor,
            match=f"{SESSION_REDIS_KEY_PREFIX}*",
            count=100,
        )
        for key in keys:
            if not key.startswith(SESSION_REDIS_KEY_PREFIX):
                continue
            session_id = key[len(SESSION_REDIS_KEY_PREFIX) :]
            if not session_id:
                continue
            try:
                raw = await client.get(to_session_redis_key(session_id))
                if not raw:
                    continue
                session = parse_stored_session(json.loads(raw), __import__("time").time() * 1000)
                updated_at = _resolve_updated_at(session, __import__("time").time() * 1000)
                item = _to_dialogue_item(session_id, session, updated_at)
                if item is not None:
                    dialogues.append(item)
            except (json.JSONDecodeError, ValueError):
                logger.warning("[sessionStore:redis] skip unreadable session key: %s", key)

        if cursor == 0:
            break

    dialogues.sort(key=lambda item: item.updatedAt, reverse=True)
    return dialogues[:limit]


def merge_recent_dialogue_items(
    primary: list[RecentDialogueItem],
    secondary: list[RecentDialogueItem],
    limit: int,
) -> list[RecentDialogueItem]:
    by_id: dict[str, RecentDialogueItem] = {}
    for item in [*primary, *secondary]:
        existing = by_id.get(item.sessionId)
        if existing is None or item.updatedAt > existing.updatedAt:
            by_id[item.sessionId] = item
    return sorted(by_id.values(), key=lambda item: item.updatedAt, reverse=True)[:limit]


async def list_recent_dialogues(limit: int = 10) -> list[RecentDialogueItem]:
    capped = min(max(int(limit), 1), 50)
    file_items = await list_recent_dialogues_from_files(capped * 2)

    if resolve_session_store_mode() != "redis":
        return file_items[:capped]

    try:
        redis_items = await list_recent_dialogues_from_redis(capped * 2)
        return merge_recent_dialogue_items(file_items, redis_items, capped)
    except Exception as error:
        logger.warning("[sessionStore] list_recent_dialogues redis failed: %s", error)
        return file_items[:capped]
