from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class DegradePolicy:
    max_tool_steps: int
    max_output_tokens: int


def resolve_degrade_policy(load_percent: int) -> DegradePolicy:
    if load_percent >= 95:
        return DegradePolicy(max_tool_steps=2, max_output_tokens=1024)
    if load_percent >= 80:
        return DegradePolicy(max_tool_steps=4, max_output_tokens=2048)
    return DegradePolicy(max_tool_steps=8, max_output_tokens=4096)


def resolve_load_percent() -> int:
    try:
        return int(os.getenv("AI_LOAD_PERCENT", "0") or "0")
    except ValueError:
        return 0
