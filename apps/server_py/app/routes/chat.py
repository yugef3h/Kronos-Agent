from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Header, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.stream_service import stream_chat

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatStreamBody(BaseModel):
    prompt: str = Field(min_length=1)
    sessionUserContent: Optional[str] = Field(default=None, min_length=1)
    sessionId: str = Field(min_length=1)
    imageDataUrls: Optional[List[str]] = Field(default=None)


@router.post("/api/chat-stream")
async def chat_stream(
    body: ChatStreamBody,
    request: Request,
    last_event_id: Optional[str] = Header(default="0", alias="last-event-id"),
) -> StreamingResponse:
    parsed_last_event_id = int(last_event_id or "0")
    image_data_urls = [
        url for url in (body.imageDataUrls or []) if url.startswith("data:image/")
    ]

    logger.warning(
        "[playground-chat] POST /api/chat-stream sessionId=%s promptChars=%s",
        body.sessionId,
        len(body.prompt),
    )

    async def event_generator():
        async for chunk in stream_chat(
            prompt=body.prompt,
            session_id=body.sessionId,
            last_event_id=parsed_last_event_id,
            session_user_content=body.sessionUserContent,
            image_data_urls=image_data_urls or None,
        ):
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream;charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
