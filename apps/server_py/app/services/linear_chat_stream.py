from __future__ import annotations

import time
from typing import AsyncIterator, List, Optional, Union

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.domain.session_store import Message
from app.services.chat_model import get_chat_model


def _to_langchain_message(message: Message) -> Union[HumanMessage, AIMessage]:
    if message.role == "user":
        return HumanMessage(content=message.content)
    return AIMessage(content=message.content)


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
) -> AsyncIterator[dict]:
    model = get_chat_model()
    messages = []
    if memory_summary and memory_summary.strip():
        messages.append(SystemMessage(content=f"Conversation memory summary:\n{memory_summary.strip()}"))
    messages.extend(_to_langchain_message(message) for message in history)
    messages.append(HumanMessage(content=prompt))

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

    async for chunk in model.astream(messages):
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
