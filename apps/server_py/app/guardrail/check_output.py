from __future__ import annotations

from app.guardrail.check_input import GuardrailCheckResult
from app.guardrail.config import get_guardrail_block_patterns, is_guardrail_enabled


def check_output_guardrail(text: str) -> GuardrailCheckResult:
    if not is_guardrail_enabled():
        return {"blocked": False}

    trimmed = text.strip()
    if not trimmed:
        return {"blocked": False}

    for pattern in get_guardrail_block_patterns():
        if pattern.search(trimmed):
            return {
                "blocked": True,
                "reason": f"output matched blocked pattern: {pattern.pattern}",
            }

    return {"blocked": False}
