from __future__ import annotations

from typing import Literal, TypedDict, Union

from app.guardrail.config import (
    get_guardrail_block_patterns,
    get_guardrail_max_prompt_chars,
    is_guardrail_enabled,
)


class GuardrailBlocked(TypedDict):
    blocked: Literal[True]
    reason: str


class GuardrailAllowed(TypedDict):
    blocked: Literal[False]


GuardrailCheckResult = Union[GuardrailBlocked, GuardrailAllowed]


def check_input_guardrail(text: str) -> GuardrailCheckResult:
    if not is_guardrail_enabled():
        return {"blocked": False}

    trimmed = text.strip()
    if not trimmed:
        return {"blocked": True, "reason": "empty prompt"}

    max_chars = get_guardrail_max_prompt_chars()
    if len(trimmed) > max_chars:
        return {"blocked": True, "reason": f"prompt exceeds {max_chars} chars"}

    for pattern in get_guardrail_block_patterns():
        if pattern.search(trimmed):
            return {
                "blocked": True,
                "reason": f"matched blocked pattern: {pattern.pattern}",
            }

    return {"blocked": False}
