"""Configurable rule profiles for guardrail checks."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Literal, Optional

RuleProfile = Literal["strict", "dev", "off"]


@dataclass
class GuardrailProfile:
    name: RuleProfile
    check_empty: bool = True
    check_max_length: bool = True
    max_prompt_chars: int = 12000
    check_block_patterns: bool = True
    check_pii: bool = True
    check_sensitive_words: bool = True
    sensitive_profile: str = "strict"   # 'strict' = block, 'dev' = warn only
    pii_action: str = "block"           # 'block' or 'mask'
    block_on_any: bool = False          # Block if ANY check fails (strict mode)


PROFILES: dict[str, GuardrailProfile] = {
    "strict": GuardrailProfile(
        name="strict",
        check_empty=True,
        check_max_length=True,
        max_prompt_chars=8000,
        check_block_patterns=True,
        check_pii=True,
        check_sensitive_words=True,
        sensitive_profile="strict",
        pii_action="block",
        block_on_any=True,
    ),
    "dev": GuardrailProfile(
        name="dev",
        check_empty=True,
        check_max_length=True,
        max_prompt_chars=12000,
        check_block_patterns=True,
        check_pii=True,
        check_sensitive_words=True,
        sensitive_profile="dev",
        pii_action="mask",
        block_on_any=False,
    ),
    "off": GuardrailProfile(
        name="off",
        check_empty=False,
        check_max_length=False,
        check_block_patterns=False,
        check_pii=False,
        check_sensitive_words=False,
    ),
}


def resolve_guardrail_profile() -> RuleProfile:
    """Resolve the active guardrail profile from environment."""
    raw = os.getenv("GUARDRAIL_PROFILE", "dev").strip().lower()
    if raw in ("strict", "dev", "off"):
        return raw  # type: ignore[return-value]
    return "dev"


def get_active_profile() -> GuardrailProfile:
    """Get the currently active guardrail profile configuration."""
    profile_name = resolve_guardrail_profile()
    return PROFILES.get(profile_name, PROFILES["dev"])
