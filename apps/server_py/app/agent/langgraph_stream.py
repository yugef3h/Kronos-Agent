from __future__ import annotations

import os
import time
from typing import Any, AsyncIterator, List, Optional

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from app.agent.messages import find_current_turn_assistant_text
from app.agent.timeline import TimelineEvent, create_timeline_event
from app.agent.tool_stream_mapper import map_langgraph_update_to_timeline_events
from app.config import get_settings
from app.domain.session_store import Message
from app.infra.langfuse_init import create_langfuse_handler
from app.prompts.default_system_prompt import DEFAULT_SYSTEM_PROMPT
from app.services.chat_model import get_chat_model
from app.tools.agent_hint import build_playground_agent_system_hint
from app.tools.registry import PlaygroundToolRegistry, list_registry_tools


def _to_langchain_message(message: Message) -> HumanMessage | AIMessage:
    if message.role == "user":
        return HumanMessage(content=message.content)
    return AIMessage(content=message.content)


def _is_stream_tuple(chunk: Any) -> bool:
    """Detect LangGraph's (mode, payload) stream tuples.

    LangGraph's astream() with stream_mode=['updates', 'values'] emits
    tuples where chunk[0] is the mode name ('updates' or 'values') and
    chunk[1] is the state payload dict.
    """
    return (
        isinstance(chunk, tuple)
        and len(chunk) == 2
        and isinstance(chunk[0], str)
    )


def _resolve_recursion_limit() -> int:
    """Choose the agent recursion limit based on current system load.

    Reduces tool-calling depth when the AI service reports high load,
    trading capability for reliability.
    """
    settings = get_settings()
    try:
        load_percent = int(os.getenv("AI_LOAD_PERCENT", "0") or "0")
    except ValueError:
        load_percent = 0

    if load_percent >= 95:
        degrade_steps = 2
    elif load_percent >= 80:
        degrade_steps = 4
    else:
        degrade_steps = 8
    return min(settings.langgraph_max_tool_steps, degrade_steps)


async def stream_langgraph_chat_reply(
    prompt: str,
    history: List[Message],
    memory_summary: Optional[str] = None,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    registry: Optional[PlaygroundToolRegistry] = None,
) -> AsyncIterator[dict]:
    from app.tools.registry import build_tool_registry

    settings = get_settings()
    active_registry = registry or build_tool_registry(settings.tavily_api_key)
    tools = list_registry_tools(active_registry)
    agent_hint = build_playground_agent_system_hint(active_registry)

    yield create_timeline_event("plan", "start", "LangGraph React Agent 初始化。")

    model = get_chat_model()
    agent = create_react_agent(model, tools)

    initial_messages: list[BaseMessage] = [
        SystemMessage(content=DEFAULT_SYSTEM_PROMPT),
    ]
    if agent_hint:
        initial_messages.append(SystemMessage(content=agent_hint))
    if memory_summary and memory_summary.strip():
        initial_messages.append(
            SystemMessage(content=f"Conversation memory summary:\n{memory_summary}")
        )
    initial_messages.extend(_to_langchain_message(item) for item in history)
    initial_messages.append(HumanMessage(content=prompt))

    yield create_timeline_event(
        "plan",
        "info",
        f"LangGraph 已启动（已注册 {len(tools)} 个工具）。",
    )
    yield create_timeline_event("reason", "start", "LangGraph 推理开始。")

    turn_thread_id = f"{session_id or 'session'}-turn-{int(time.time() * 1000)}"
    recursion_limit = _resolve_recursion_limit()

    langfuse_handler = create_langfuse_handler(
        session_id=session_id,
        user_id=user_id,
        tags=["kronos", "langgraph"],
    )
    config: dict[str, Any] = {
        "configurable": {"thread_id": turn_thread_id},
        "recursion_limit": recursion_limit,
    }
    if langfuse_handler is not None:
        config["callbacks"] = [langfuse_handler]

    previous_text = ""
    async for chunk in agent.astream(
        {"messages": initial_messages},
        stream_mode=["updates", "values"],
        config=config,
    ):
        if _is_stream_tuple(chunk):
            mode, payload = chunk
            if mode == "updates" and isinstance(payload, dict):
                for node_name, node_state in payload.items():
                    messages = (
                        node_state.get("messages")
                        if isinstance(node_state, dict)
                        else None
                    )
                    if not messages:
                        continue
                    for event in map_langgraph_update_to_timeline_events(
                        node_name,
                        messages,
                    ):
                        yield event
                continue

            if mode == "values" and isinstance(payload, dict):
                messages = payload.get("messages") or []
                full_text = find_current_turn_assistant_text(messages)
                delta = full_text[len(previous_text) :]
                if delta:
                    previous_text = full_text
                    yield {"type": "content", "content": delta}
                continue

        if isinstance(chunk, dict) and "messages" in chunk:
            messages = chunk.get("messages") or []
            full_text = find_current_turn_assistant_text(messages)
            delta = full_text[len(previous_text) :]
            if delta:
                previous_text = full_text
                yield {"type": "content", "content": delta}

    yield create_timeline_event("reason", "end", "LangGraph 推理完成。")
