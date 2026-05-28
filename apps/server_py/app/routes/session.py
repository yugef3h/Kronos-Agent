from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from app.domain.session_store import (
    SessionAppendMessage,
    SessionSnapshot,
    append_session_messages,
    get_session_snapshot,
    list_recent_dialogues,
)

router = APIRouter()


class RecentDialoguesResponse(BaseModel):
    items: list


class SessionAppendBody(BaseModel):
    sessionId: str = Field(min_length=1)
    messages: List[SessionAppendMessage] = Field(min_length=1, max_length=20)

    @field_validator("messages")
    @classmethod
    def validate_message_content(cls, messages: List[SessionAppendMessage]) -> List[SessionAppendMessage]:
        for message in messages:
            if len(message.content) < 1 or len(message.content) > 3000:
                raise ValueError("message content length must be 1..3000")
        return messages


@router.get("/api/session/{session_id}", response_model=SessionSnapshot)
async def session_snapshot(session_id: str) -> SessionSnapshot:
    return await get_session_snapshot(session_id)


@router.get("/api/sessions/recent")
async def sessions_recent(limit: int = Query(default=10)) -> dict:
    safe_limit = min(max(limit, 1), 50) if isinstance(limit, int) else 10
    items = await list_recent_dialogues(safe_limit)
    return {"items": items}


@router.post("/api/session/append", status_code=204)
async def session_append(body: SessionAppendBody) -> Response:
    try:
        await append_session_messages(body.sessionId, body.messages)
        return Response(status_code=204)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
