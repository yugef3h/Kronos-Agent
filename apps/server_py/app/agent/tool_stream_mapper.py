from __future__ import annotations

from typing import Any

from app.agent.messages import read_message_text, safe_stringify
from app.agent.timeline import TimelineEvent, create_timeline_event


def _read_tool_calls(message: Any) -> list[dict[str, Any]]:
    tool_calls = getattr(message, "tool_calls", None)
    if not isinstance(tool_calls, list):
        return []

    parsed: list[dict[str, Any]] = []
    for item in tool_calls:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str):
            continue
        parsed.append(
            {
                "name": name,
                "args": item.get("args"),
                "id": item.get("id"),
            }
        )
    return parsed


def map_langgraph_update_to_timeline_events(
    node_name: str,
    messages: list[Any],
) -> list[TimelineEvent]:
    events: list[TimelineEvent] = []

    for message in messages:
        message_type = getattr(message, "type", None)

        if node_name == "agent" and message_type in {"ai", "assistant"}:
            for call in _read_tool_calls(message):
                events.append(
                    create_timeline_event(
                        "tool",
                        "start",
                        f"工具 {call['name']} 开始执行。",
                        tool_name=call["name"],
                        tool_input=safe_stringify(call.get("args") or {}),
                    )
                )

        if node_name == "tools" and message_type == "tool":
            tool_name = getattr(message, "name", None)
            resolved_name = tool_name if isinstance(tool_name, str) else "unknown_tool"
            output = read_message_text(message)
            status = getattr(message, "status", None)
            failed = status == "error"
            events.append(
                create_timeline_event(
                    "tool",
                    "end",
                    (
                        f"工具 {resolved_name} 执行失败。"
                        if failed
                        else f"工具 {resolved_name} 执行完成。"
                    ),
                    tool_name=resolved_name,
                    tool_output=None if failed else output,
                    tool_error=output if failed else None,
                )
            )

    return events
