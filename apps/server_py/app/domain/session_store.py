from __future__ import annotations

import time
from typing import List

from app.domain.session.errors import SessionConflictError, SessionStreamLockBusyError
from app.domain.session.get_repository import (
    get_file_session_repository_or_null,
    get_session_repository,
    resolve_session_store_mode,
)
from app.domain.session.list_recent import list_recent_dialogues
from app.domain.session.normalize import create_empty_session
from app.domain.session.types import (
    AttachmentMeta,
    Message,
    RecentDialogueItem,
    Session,
    SessionAppendMessage,
)
from app.domain.session.write_queue import enqueue_session_save, flush_session_save_queue
from app.memory.constants import (
    CONTEXT_WINDOW_TOKENS,
    INPUT_BUDGET_RATIO,
    RESERVED_OUTPUT_TOKENS,
    SUMMARY_TRIGGER_MESSAGE_COUNT,
)
from app.memory.token_estimate import estimate_text_tokens
from pydantic import BaseModel

__all__ = [
    "AttachmentMeta",
    "Message",
    "RecentDialogueItem",
    "Session",
    "SessionAppendMessage",
    "SessionConflictError",
    "SessionStreamLockBusyError",
    "SessionSnapshot",
    "MemoryMetrics",
    "init_session_store",
    "load_session",
    "save_session",
    "save_session_async",
    "wait_for_session_persist",
    "get_session",
    "persist_session",
    "list_recent_dialogues",
    "get_session_snapshot",
    "append_session_messages",
    "resolve_session_store_mode",
]


class MemoryMetrics(BaseModel):
    messageCount: int
    conversationTokensEstimate: int
    summaryTokensEstimate: int
    budgetTokensEstimate: int
    summaryTriggerMessageCount: int
    isSummaryThresholdReached: bool


class SessionSnapshot(BaseModel):
    messages: List[Message]
    memorySummary: str
    memorySummaryUpdatedAt: int | None
    lastId: int
    memoryMetrics: MemoryMetrics


async def init_session_store() -> None:
    await get_session_repository().init()


async def load_session(session_id: str) -> Session:
    return await get_session_repository().load(session_id)


async def save_session(session_id: str, session: Session) -> Session:
    saved = await get_session_repository().save(
        session_id,
        session,
        expected_version=session.version,
    )
    session.version = saved.version
    session.messages = list(saved.messages)
    return saved


def save_session_async(session_id: str, session: Session) -> None:
    enqueue_session_save(session_id, session, save_session)


async def wait_for_session_persist(session_id: str) -> None:
    await flush_session_save_queue(session_id)


def get_session(session_id: str) -> Session:
    if resolve_session_store_mode() == "redis":
        raise RuntimeError("get_session() is unavailable when SESSION_STORE=redis; use load_session()")

    file_repo = get_file_session_repository_or_null()
    if file_repo is None:
        return create_empty_session()
    return file_repo.get_session_sync(session_id)


def persist_session(session_id: str, session: Session) -> None:
    save_session_async(session_id, session)


async def get_session_snapshot(session_id: str) -> SessionSnapshot:
    session = await load_session(session_id)
    message_count = len(session.messages)
    summary_tokens_estimate = estimate_text_tokens(session.memorySummary)
    conversation_tokens_estimate = sum(
        estimate_text_tokens(message.content) + 4 for message in session.messages
    )
    budget_tokens_estimate = int(CONTEXT_WINDOW_TOKENS * INPUT_BUDGET_RATIO) - RESERVED_OUTPUT_TOKENS
    is_summary_threshold_reached = message_count >= SUMMARY_TRIGGER_MESSAGE_COUNT

    return SessionSnapshot(
        messages=session.messages,
        memorySummary=session.memorySummary,
        memorySummaryUpdatedAt=session.memorySummaryUpdatedAt,
        lastId=session.lastId,
        memoryMetrics=MemoryMetrics(
            messageCount=message_count,
            conversationTokensEstimate=conversation_tokens_estimate,
            summaryTokensEstimate=summary_tokens_estimate,
            budgetTokensEstimate=budget_tokens_estimate,
            summaryTriggerMessageCount=SUMMARY_TRIGGER_MESSAGE_COUNT,
            isSummaryThresholdReached=is_summary_threshold_reached,
        ),
    )


# Safety cap: max messages allowed in a single append call.
MAX_APPEND_MESSAGES = 500


async def append_session_messages(session_id: str, messages: List[SessionAppendMessage]) -> None:
    session = await load_session(session_id)
    now = int(time.time() * 1000)
    next_messages: List[Message] = []

    # Truncate oversized bulk appends to prevent DoS
    effective = messages[:MAX_APPEND_MESSAGES]
    for index, message in enumerate(effective):
        content = message.content.strip()
        attachments = message.attachments
        if not content and not attachments:
            continue
        next_messages.append(
            Message(
                role=message.role,
                content=content,
                timestamp=now + index,
                attachments=attachments,
            )
        )

    if not next_messages:
        return

    session.messages.extend(next_messages)
    session.lastId += len(next_messages)
    await save_session(session_id, session)
