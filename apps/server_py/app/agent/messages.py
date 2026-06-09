from __future__ import annotations

import json
from typing import Any


def read_message_type(message: Any) -> str | None:
    get_type = getattr(message, "type", None)
    if isinstance(get_type, str):
        return get_type
    get_type_fn = getattr(message, "get_type", None)
    if callable(get_type_fn):
        value = get_type_fn()
        return value if isinstance(value, str) else None
    return None


def read_message_text(message: Any) -> str:
    if message is None:
        return ""

    raw = getattr(message, "content", "")
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        parts: list[str] = []
        for item in raw:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "".join(parts)
    if isinstance(raw, dict) and isinstance(raw.get("text"), str):
        return raw["text"]
    return ""


def safe_stringify(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except TypeError:
        return str(value)


def is_human_message(message: Any) -> bool:
    message_type = read_message_type(message)
    return message_type in {"human", "user"}


def is_assistant_message(message: Any) -> bool:
    message_type = read_message_type(message)
    return message_type in {"ai", "assistant"}


def find_current_turn_assistant_text(messages: list[Any]) -> str:
    """Return the text content of the last assistant message in the current turn.

    A turn starts after the most recent human message. Returns empty string
    if no assistant message follows the last human message.
    """
    # Find the last human message index
    last_human = next(
        (i for i in range(len(messages) - 1, -1, -1) if is_human_message(messages[i])),
        -1,
    )
    # Find the last assistant message after the human message
    for msg in reversed(messages[last_human + 1:]):
        if is_assistant_message(msg):
            return read_message_text(msg)
    return ""
