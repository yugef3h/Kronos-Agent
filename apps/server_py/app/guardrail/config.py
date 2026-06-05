from __future__ import annotations

import os
import re

DEFAULT_BLOCK_PATTERNS = (
    r"password\s*[:=]",
    r"api[_-]?key\s*[:=]",
    r"1[3-9]\d{9}",
)


def is_guardrail_enabled() -> bool:
    return os.getenv("GUARDRAIL_ENABLED", "false").strip().lower() == "true"


def get_guardrail_block_patterns() -> list[re.Pattern[str]]:
    raw = os.getenv("GUARDRAIL_BLOCK_PATTERNS", "").strip()
    patterns = (
        [item.strip() for item in raw.split(",") if item.strip()]
        if raw
        else list(DEFAULT_BLOCK_PATTERNS)
    )
    return [re.compile(pattern, re.IGNORECASE) for pattern in patterns]


def get_guardrail_max_prompt_chars() -> int:
    parsed = int(os.getenv("GUARDRAIL_MAX_PROMPT_CHARS", "12000") or "12000")
    return parsed if parsed > 0 else 12000
