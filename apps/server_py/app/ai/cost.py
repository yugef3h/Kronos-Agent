"""Request cost estimation for token usage tracking."""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Approximate pricing per 1M tokens (USD) — update from provider pricing pages
PRICING_PER_1M: dict[str, tuple[float, float]] = {
    "doubao-pro-256k": (0.80, 2.00),
    "doubao-pro-128k": (0.50, 1.50),
    "doubao-pro-32k": (0.30, 1.00),
    "doubao-lite-128k": (0.10, 0.40),
    "doubao-lite-32k": (0.05, 0.20),
    "default": (0.50, 1.50),
}


@dataclass
class CostEstimate:
    input_tokens: int
    output_tokens: int
    model_name: str
    input_cost_usd: float = 0.0
    output_cost_usd: float = 0.0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def total_cost_usd(self) -> float:
        return self.input_cost_usd + self.output_cost_usd


def estimate_cost(
    input_tokens: int,
    output_tokens: int,
    model_name: str = "default",
) -> CostEstimate:
    """Estimate USD cost for a request based on token counts and model pricing."""
    input_price, output_price = PRICING_PER_1M.get(
        model_name, PRICING_PER_1M["default"]
    )

    estimate = CostEstimate(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        model_name=model_name,
        input_cost_usd=round(input_tokens / 1_000_000 * input_price, 6),
        output_cost_usd=round(output_tokens / 1_000_000 * output_price, 6),
    )

    logger.debug(
        "Cost estimate: model=%s input=%d output=%d cost=$%.6f",
        model_name, input_tokens, output_tokens, estimate.total_cost_usd,
    )
    return estimate


def estimate_text_tokens(text: str) -> int:
    """Rough token count estimate for a text string (~4 chars per token)."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def estimate_messages_tokens(messages: list[dict]) -> int:
    """Estimate total token count across a list of chat messages."""
    total = 0
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            total += estimate_text_tokens(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and "text" in part:
                    total += estimate_text_tokens(part["text"])
    return max(total, 1)


def track_request_cost(
    session_id: str,
    input_tokens: int,
    output_tokens: int,
    model_name: str = "default",
) -> CostEstimate:
    """Estimate cost and check against token budget for a session."""
    from app.ai.token_budget import check_token_budget_rate_limit

    cost = estimate_cost(input_tokens, output_tokens, model_name)

    within_budget = check_token_budget_rate_limit(
        session_id, cost.total_tokens
    )

    if not within_budget:
        logger.warning(
            "Request exceeds token budget: session=%s tokens=%d cost=$%.6f",
            session_id, cost.total_tokens, cost.total_cost_usd,
        )

    return cost
