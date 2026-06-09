"""Token budget rate limiter — mirrors checkTokenBudgetRateLimit.ts."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# In-memory budget store (per-session tracking)
_budget_store: dict[str, "TokenBudget"] = {}


@dataclass
class TokenBudget:
    session_id: str
    max_tokens: int = 100_000
    used_tokens: int = 0
    reset_at: float = field(default_factory=lambda: time.time() + 3600)
    request_count: int = 0

    @property
    def remaining(self) -> int:
        return max(0, self.max_tokens - self.used_tokens)

    @property
    def is_exhausted(self) -> bool:
        return self.used_tokens >= self.max_tokens

    def consume(self, tokens: int) -> bool:
        """Try to consume tokens. Returns True if allowed."""
        if self.is_exhausted:
            return False
        self.used_tokens += tokens
        self.request_count += 1
        return True

    def reset_if_stale(self) -> None:
        """Reset budget if TTL expired."""
        if time.time() >= self.reset_at:
            self.used_tokens = 0
            self.reset_at = time.time() + 3600


def get_or_create_budget(
    session_id: str,
    *,
    max_tokens: int = 100_000,
    ttl_seconds: float = 3600,
) -> TokenBudget:
    """Get or create a token budget for a session.

    Note: _budget_store is an in-memory dict — not safe across
    multiple processes. Use Redis-backed storage for multi-worker deployments.
    """
    now = time.time()
    if session_id not in _budget_store:
        _budget_store[session_id] = TokenBudget(
            session_id=session_id,
            max_tokens=max_tokens,
            reset_at=now + ttl_seconds,
        )
    budget = _budget_store[session_id]
    # Lazy cleanup: if the budget expired long ago, recreate it
    if now >= budget.reset_at + ttl_seconds:
        del _budget_store[session_id]
        return get_or_create_budget(session_id, max_tokens=max_tokens, ttl_seconds=ttl_seconds)
    budget.reset_if_stale()
    return budget


def check_token_budget_rate_limit(
    session_id: str,
    estimated_tokens: int = 0,
    *,
    max_tokens: Optional[int] = None,
) -> bool:
    """Check if a request is within the token budget rate limit.

    Returns True if the request is allowed, False if over limit.
    """
    if not session_id:
        return True

    limit = max_tokens or 100_000
    budget = get_or_create_budget(session_id, max_tokens=limit)
    estimated = max(estimated_tokens, 1)

    allowed = budget.consume(estimated)
    if not allowed:
        logger.warning(
            "Token budget exhausted: session=%s used=%d limit=%d remaining=%d",
            session_id, budget.used_tokens, budget.max_tokens, budget.remaining,
        )
    return allowed


def get_budget_stats(session_id: str) -> dict:
    """Return current budget statistics for a session."""
    budget = _budget_store.get(session_id)
    if budget is None:
        return {"session_id": session_id, "exists": False}
    budget.reset_if_stale()
    return {
        "session_id": session_id,
        "exists": True,
        "max_tokens": budget.max_tokens,
        "used_tokens": budget.used_tokens,
        "remaining": budget.remaining,
        "request_count": budget.request_count,
        "is_exhausted": budget.is_exhausted,
        "reset_at": budget.reset_at,
    }


def cleanup_stale_budgets() -> int:
    """Remove budgets past their TTL. Returns count removed."""
    now = time.time()
    stale = [sid for sid, b in _budget_store.items() if now >= b.reset_at]
    for sid in stale:
        del _budget_store[sid]
    return len(stale)
