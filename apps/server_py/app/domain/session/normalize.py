from __future__ import annotations

import json
from typing import Any

from app.domain.session.types import Message, Session


def create_empty_session() -> Session:
    return Session(
        version=0,
        lastId=0,
        messages=[],
        memorySummary="",
        memorySummaryUpdatedAt=None,
        summaryArchiveMessageCount=0,
    )


def normalize_session(session: Session, base_timestamp: float) -> Session:
    normalized_messages: list[Message] = []
    for index, message in enumerate(session.messages):
        timestamp = (
            message.timestamp
            if isinstance(message.timestamp, int)
            else int(base_timestamp) + index
        )
        normalized_messages.append(message.model_copy(update={"timestamp": timestamp}))

    return session.model_copy(
        update={
            "version": session.version if isinstance(session.version, int) else 0,
            "messages": normalized_messages,
        }
    )


def parse_stored_session(raw: Any, base_timestamp: float) -> Session:
    if isinstance(raw, dict):
        data = raw
    elif isinstance(raw, str):
        data = json.loads(raw)
    else:
        data = {}

    return normalize_session(Session.model_validate(data), base_timestamp)
