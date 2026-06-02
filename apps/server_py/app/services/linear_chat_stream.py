from __future__ import annotations

import time
from typing import AsyncIterator, List, Optional

from app.domain.session_store import Message
from app.infra.langfuse_init import create_langfuse_handler
from app.prompts.linear_chat_prompt import format_linear_chat_messages
from app.services.chat_model import get_chat_model


def _read_chunk_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "".join(parts)
    return ""


async def stream_linear_chat_reply(
    prompt: str,
    history: List[Message],
    memory_summary: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> AsyncIterator[dict]:
    model = get_chat_model()
    messages = format_linear_chat_messages(
        prompt=prompt,
        history=history,
        memory_summary=memory_summary,
    )

    langfuse_handler = create_langfuse_handler(
        session_id=session_id,
        user_id=user_id,
    )
    invoke_config = (
        {"callbacks": [langfuse_handler]} if langfuse_handler else {}
    )

    yield {
        "type": "timeline",
        "stage": "plan",
        "status": "start",
        "message": "规划器开始分析当前提示词意图。",
        "timestamp": int(time.time() * 1000),
    }

    yield {
        "type": "timeline",
        "stage": "reason",
        "status": "start",
        "message": "开始生成回复。",
        "timestamp": int(time.time() * 1000),
    }

    async for chunk in model.astream(messages, config=invoke_config):
        text = _read_chunk_text(chunk.content)
        if text:
            yield {"type": "content", "content": text}

    yield {
        "type": "timeline",
        "stage": "reason",
        "status": "end",
        "message": "回复生成完成。",
        "timestamp": int(time.time() * 1000),
    }
