from __future__ import annotations

import json
import logging
import time
from typing import AsyncIterator, List, Optional

from app.domain.session.errors import SessionConflictError
from app.domain.session.types import Message
from app.domain.session_store import (
    load_session,
    persist_session,
    wait_for_session_persist,
)
from app.memory.orchestrator import create_memory_plan
from app.memory.types import SessionMemoryState
from app.services.linear_chat_stream import stream_linear_chat_reply

logger = logging.getLogger(__name__)


async def _stream_mock_reply(prompt: str) -> AsyncIterator[str]:
    mock_text = (
        f"You asked: {prompt}. Configure Doubao env vars to switch from mock to LangChain stream."
    )
    for char in mock_text:
        yield char
        await __import__("asyncio").sleep(0.024)


def _format_sse(payload: dict, event_id: int) -> str:
    body = json.dumps(payload, ensure_ascii=False)
    return f"data: {body}\nid: {event_id}\n\n"


async def _wait_for_session_persist_safe(session_id: str) -> str | None:
    try:
        await wait_for_session_persist(session_id)
        return None
    except SessionConflictError:
        return f"会话版本冲突（{session_id}），请刷新后重试。"
    except Exception as error:
        reason = str(error)[:180] if str(error) else "unknown error"
        return f"会话落盘失败：{reason}"


async def _stream_chat_body(
    prompt: str,
    session_id: str,
    last_event_id: int = 0,
    session_user_content: Optional[str] = None,
    image_data_urls: Optional[List[str]] = None,
) -> AsyncIterator[str]:
    session = await load_session(session_id)
    user_timestamp = int(time.time() * 1000)
    persisted_user_line = (
        session_user_content.strip()
        if isinstance(session_user_content, str) and session_user_content.strip()
        else prompt
    )
    user_content = (
        f"{persisted_user_line}\n[附图×{len(image_data_urls)}]"
        if image_data_urls
        else persisted_user_line
    )

    session.messages.append(
        Message(role="user", content=user_content, timestamp=user_timestamp)
    )
    persist_session(session_id, session)

    assistant_text = ""
    event_id = 0

    memory_plan = create_memory_plan(
        prompt=prompt,
        messages=session.messages[:-1],
        memory_state=SessionMemoryState(
            summary=session.memorySummary,
            summaryUpdatedAt=session.memorySummaryUpdatedAt,
            summaryArchiveMessageCount=session.summaryArchiveMessageCount,
        ),
    )
    session.memorySummary = memory_plan.memorySummary
    if memory_plan.summaryUpdated:
        session.memorySummaryUpdatedAt = int(time.time() * 1000)
    session.summaryArchiveMessageCount = memory_plan.summaryArchiveMessageCount

    event_id += 1
    if event_id > last_event_id:
        yield _format_sse(
            {
                "type": "timeline",
                "stage": "plan",
                "status": "info",
                "message": (
                    f"记忆编排完成：history≈{memory_plan.diagnostics.historyTokensEstimate} tokens，"
                    f"summary≈{memory_plan.diagnostics.summaryTokensEstimate} tokens，"
                    f"输入预算≈{memory_plan.diagnostics.budgetTokensEstimate} tokens。"
                ),
                "sessionId": session_id,
                "eventId": event_id,
                "timestamp": int(time.time() * 1000),
            },
            event_id,
        )

    try:
        logger.warning("[playground-chat] stream_chat agent pipeline start sessionId=%s", session_id)
        async for event in stream_linear_chat_reply(
            prompt=prompt,
            history=memory_plan.history,
            memory_summary=memory_plan.memorySummary,
            session_id=session_id,
        ):
            event_id += 1
            if event_id <= last_event_id:
                continue

            if event["type"] == "timeline":
                yield _format_sse(
                    {
                        "type": "timeline",
                        "stage": event["stage"],
                        "status": event["status"],
                        "message": event["message"],
                        "timestamp": event.get("timestamp", int(time.time() * 1000)),
                        "sessionId": session_id,
                        "eventId": event_id,
                    },
                    event_id,
                )
                continue

            assistant_text += event["content"]
            yield _format_sse(
                {
                    "type": "content",
                    "content": event["content"],
                    "sessionId": session_id,
                    "eventId": event_id,
                },
                event_id,
            )
    except Exception as error:
        assistant_text = ""
        fallback_reason = str(error)[:180] if str(error) else "unknown upstream error"
        logger.warning(
            "[stream_chat] fallback enabled for session %s. reason: %s",
            session_id,
            fallback_reason,
        )

        event_id += 1
        if event_id > last_event_id:
            yield _format_sse(
                {
                    "type": "timeline",
                    "stage": "reason",
                    "status": "info",
                    "message": f"Playground 流式响应失败，已启用 Mock 降级回复。原因：{fallback_reason}",
                    "sessionId": session_id,
                    "eventId": event_id,
                    "timestamp": int(time.time() * 1000),
                },
                event_id,
            )

        async for token in _stream_mock_reply(prompt):
            event_id += 1
            if event_id <= last_event_id:
                continue
            assistant_text += token
            yield _format_sse(
                {
                    "type": "content",
                    "content": token,
                    "sessionId": session_id,
                    "eventId": event_id,
                },
                event_id,
            )

    session.messages.append(
        Message(
            role="assistant",
            content=assistant_text,
            timestamp=int(time.time() * 1000),
        )
    )

    finalize_plan = create_memory_plan(
        prompt=prompt,
        messages=session.messages,
        memory_state=SessionMemoryState(
            summary=session.memorySummary,
            summaryUpdatedAt=session.memorySummaryUpdatedAt,
            summaryArchiveMessageCount=session.summaryArchiveMessageCount,
        ),
    )
    session.memorySummary = finalize_plan.memorySummary
    if finalize_plan.summaryUpdated:
        session.memorySummaryUpdatedAt = int(time.time() * 1000)
    session.summaryArchiveMessageCount = finalize_plan.summaryArchiveMessageCount

    complete_id = event_id + 1
    session.lastId = complete_id
    persist_session(session_id, session)
    persist_issue = await _wait_for_session_persist_safe(session_id)

    if persist_issue:
        event_id += 1
        if event_id > last_event_id:
            yield _format_sse(
                {
                    "type": "timeline",
                    "stage": "plan",
                    "status": "info",
                    "message": persist_issue,
                    "sessionId": session_id,
                    "eventId": event_id,
                    "timestamp": int(time.time() * 1000),
                },
                event_id,
            )

    yield _format_sse(
        {"type": "complete", "sessionId": session_id, "eventId": complete_id},
        complete_id,
    )


async def stream_chat(
    prompt: str,
    session_id: str,
    last_event_id: int = 0,
    session_user_content: Optional[str] = None,
    image_data_urls: Optional[List[str]] = None,
) -> AsyncIterator[str]:
    async for chunk in _stream_chat_body(
        prompt=prompt,
        session_id=session_id,
        last_event_id=last_event_id,
        session_user_content=session_user_content,
        image_data_urls=image_data_urls,
    ):
        yield chunk
