from __future__ import annotations

import logging
from typing import AsyncIterator, List, Optional

from app.agent.langgraph_stream import stream_langgraph_chat_reply
from app.agent.timeline import create_timeline_event
from app.config import get_settings
from app.domain.session_store import Message
from app.services.linear_chat_stream import stream_linear_chat_reply

logger = logging.getLogger(__name__)
PLAYGROUND_CHAT_LOG_PREFIX = "[playground-chat]"

# Truncation limit for error messages surfaced in timeline events.
_ERROR_REASON_MAX_CHARS = 180


def _safe_error_text(error: Exception) -> str:
    message = error.args[0] if error.args else ""
    if isinstance(message, str) and message.strip():
        return message.strip()[:_ERROR_REASON_MAX_CHARS]
    return "unknown upstream error"


async def stream_playground_agent_reply(
    prompt: str,
    history: List[Message],
    memory_summary: Optional[str] = None,
    session_id: str = "session",
    user_id: Optional[str] = None,
    image_data_urls: Optional[List[str]] = None,
) -> AsyncIterator[dict]:
    """Stream the playground agent reply with automatic fallback chain.

    Path A (linear): Used when LANGGRAPH_ENABLED=false.
        Simple LLM call without tools — fastest, no external dependencies.

    Path B (langgraph): Used when LANGGRAPH_ENABLED=true (default).
        ReAct agent with tool calling. On failure, falls back to Path A
        automatically so the user always gets a reply.
    """
    settings = get_settings()

    if not settings.langgraph_enabled:
        logger.warning(
            "%s path=A-linear-only sessionId=%s langgraphEnabled=false",
            PLAYGROUND_CHAT_LOG_PREFIX,
            session_id,
        )
        async for event in stream_linear_chat_reply(
            prompt=prompt,
            history=history,
            memory_summary=memory_summary,
            session_id=session_id,
            user_id=user_id,
        ):
            yield event
        return

    logger.warning(
        "%s path=B-langgraph sessionId=%s",
        PLAYGROUND_CHAT_LOG_PREFIX,
        session_id,
    )

    try:
        async for event in stream_langgraph_chat_reply(
            prompt=prompt,
            history=history,
            memory_summary=memory_summary,
            session_id=session_id,
            user_id=user_id,
        ):
            yield event
    except Exception as error:
        reason = _safe_error_text(error)
        yield create_timeline_event(
            "plan",
            "info",
            f"LangGraph Agent 失败，已切换线性兜底路径。原因：{reason}",
        )
        async for event in stream_linear_chat_reply(
            prompt=prompt,
            history=history,
            memory_summary=memory_summary,
            session_id=session_id,
            user_id=user_id,
        ):
            yield event
