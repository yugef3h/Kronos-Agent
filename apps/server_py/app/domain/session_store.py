from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.memory.constants import (
    CONTEXT_WINDOW_TOKENS,
    INPUT_BUDGET_RATIO,
    RESERVED_OUTPUT_TOKENS,
    SUMMARY_TRIGGER_MESSAGE_COUNT,
)
from app.memory.token_estimate import estimate_text_tokens

logger = logging.getLogger(__name__)

SERVER_PY_ROOT = Path(__file__).resolve().parent.parent.parent
SESSIONS_DIR = SERVER_PY_ROOT.parent / "server" / "data" / "sessions"

PlaygroundHistorySurface = Literal["default", "published"]


class AttachmentMeta(BaseModel):
    id: str
    type: Literal["image"] = "image"
    fileName: str
    mimeType: str
    size: int
    filePath: Optional[str] = None
    storagePath: Optional[str] = None
    createdAt: int


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: Optional[int] = None
    attachments: Optional[List[AttachmentMeta]] = None


class Session(BaseModel):
    lastId: int = 0
    messages: List[Message] = Field(default_factory=list)
    memorySummary: str = ""
    memorySummaryUpdatedAt: Optional[int] = None
    summaryArchiveMessageCount: int = 0


class SessionAppendMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    attachments: Optional[List[AttachmentMeta]] = None


class RecentDialogueItem(BaseModel):
    id: str
    sessionId: str
    updatedAt: float
    userContent: str
    playgroundSurface: PlaygroundHistorySurface
    basePlaygroundSessionId: str
    publishedChatbotWorkflowAppId: Optional[str] = None


_sessions: Dict[str, Session] = {}


def _normalize_session(session: Session, base_timestamp: float) -> Session:
    normalized: List[Message] = []
    for index, message in enumerate(session.messages):
        timestamp = message.timestamp if isinstance(message.timestamp, int) else int(base_timestamp) + index
        normalized.append(message.model_copy(update={"timestamp": timestamp}))
    return session.model_copy(update={"messages": normalized})


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


async def persist_session(session_id: str, session: Session) -> None:
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        normalized = _normalize_session(session, time.time() * 1000)
        _sessions[session_id] = normalized
        path = SESSIONS_DIR / f"{session_id}.json"
        path.write_text(normalized.model_dump_json(), encoding="utf-8")
    except OSError as error:
        logger.warning("[sessionStore] persist session %s failed: %s", session_id, error)


async def init_session_store() -> None:
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        loaded = 0
        for path in SESSIONS_DIR.glob("*.json"):
            session_id = path.stem
            try:
                raw = path.read_text(encoding="utf-8")
                stat = path.stat()
                data = _normalize_session(Session.model_validate_json(raw), stat.st_mtime * 1000)
                _sessions[session_id] = data
                loaded += 1
            except (OSError, ValueError, json.JSONDecodeError):
                logger.warning("[sessionStore] skip corrupt session file: %s", path.name)
        logger.warning("[sessionStore] loaded %s sessions", loaded)
    except OSError as error:
        logger.warning("[sessionStore] init_session_store failed: %s", error)


def get_session(session_id: str) -> Session:
    existing = _sessions.get(session_id)
    if existing is not None:
        return existing
    created = Session(
        lastId=0,
        messages=[],
        memorySummary="",
        memorySummaryUpdatedAt=None,
        summaryArchiveMessageCount=0,
    )
    _sessions[session_id] = created
    return created


async def list_recent_dialogues(limit: int = 10) -> List[RecentDialogueItem]:
    try:
        SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        dialogues: List[RecentDialogueItem] = []
        for path in SESSIONS_DIR.glob("*.json"):
            try:
                raw = path.read_text(encoding="utf-8")
                stat = path.stat()
                session = _normalize_session(Session.model_validate_json(raw), stat.st_mtime * 1000)
                session_id = path.stem
                parsed = _parse_published_playground_stream_session_id(session_id)
                playground_surface: PlaygroundHistorySurface = "published" if parsed else "default"
                base_playground_session_id = parsed[0] if parsed else session_id
                published_chatbot_workflow_app_id = parsed[1] if parsed else None

                for message in reversed(session.messages):
                    if message.role == "user":
                        dialogues.append(
                            RecentDialogueItem(
                                id=session_id,
                                sessionId=session_id,
                                updatedAt=stat.st_mtime * 1000,
                                userContent=message.content,
                                playgroundSurface=playground_surface,
                                basePlaygroundSessionId=base_playground_session_id,
                                publishedChatbotWorkflowAppId=published_chatbot_workflow_app_id,
                            )
                        )
                        break
            except (OSError, ValueError, json.JSONDecodeError):
                logger.warning("[sessionStore] skip unreadable session file: %s", path.name)

        dialogues.sort(key=lambda item: item.updatedAt, reverse=True)
        return dialogues[:limit]
    except OSError as error:
        logger.warning("[sessionStore] list_recent_dialogues failed: %s", error)
        return []


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
    memorySummaryUpdatedAt: Optional[int]
    lastId: int
    memoryMetrics: MemoryMetrics


def get_session_snapshot(session_id: str) -> SessionSnapshot:
    session = get_session(session_id)
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


async def append_session_messages(session_id: str, messages: List[SessionAppendMessage]) -> None:
    session = get_session(session_id)
    now = int(time.time() * 1000)
    next_messages: List[Message] = []

    for index, message in enumerate(messages):
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
    await persist_session(session_id, session)
