from __future__ import annotations

from app.ai.token_budget import (
    TokenBudget,
    check_token_budget_rate_limit,
    get_or_create_budget,
    get_budget_stats,
    cleanup_stale_budgets,
)
from app.ai.cost import estimate_cost, estimate_text_tokens, estimate_messages_tokens


class TestTokenBudget:
    def test_new_budget_allows_consumption(self):
        budget = TokenBudget(session_id="sess_1", max_tokens=10000)
        assert budget.remaining == 10000
        assert budget.consume(1000)
        assert budget.remaining == 9000

    def test_exhausted_budget_rejects(self):
        budget = TokenBudget(session_id="sess_2", max_tokens=100)
        budget.consume(100)
        assert budget.is_exhausted
        assert not budget.consume(1)

    def test_reset_if_stale(self):
        budget = TokenBudget(session_id="sess_3", max_tokens=1000, reset_at=0)
        budget.consume(500)
        budget.reset_if_stale()
        assert budget.used_tokens == 0

    def test_check_rate_limit_allows(self):
        result = check_token_budget_rate_limit("test_sess", estimated_tokens=100)
        assert result is True

    def test_check_rate_limit_empty_session(self):
        result = check_token_budget_rate_limit("", estimated_tokens=100)
        assert result is True

    def test_get_budget_stats_missing(self):
        stats = get_budget_stats("nonexistent_sess")
        assert stats["exists"] is False

    def test_get_budget_stats_exists(self):
        check_token_budget_rate_limit("stats_sess", estimated_tokens=50)
        stats = get_budget_stats("stats_sess")
        assert stats["exists"] is True
        assert stats["used_tokens"] == 50


class TestCostEstimation:
    def test_estimates_cost_for_known_model(self):
        cost = estimate_cost(1000, 500, "doubao-pro-128k")
        assert cost.input_tokens == 1000
        assert cost.output_tokens == 500
        assert cost.total_cost_usd > 0

    def test_estimates_text_tokens(self):
        tokens = estimate_text_tokens("hello world, this is a test")
        assert tokens > 0

    def test_estimates_messages_tokens(self):
        messages = [
            {"role": "user", "content": "what is AI?"},
            {"role": "assistant", "content": "AI stands for artificial intelligence."},
        ]
        tokens = estimate_messages_tokens(messages)
        assert tokens > 0

    def test_total_cost_is_sum(self):
        cost = estimate_cost(1000000, 500000, "doubao-pro-32k")
        assert cost.total_cost_usd == cost.input_cost_usd + cost.output_cost_usd

    def test_exhausted_session(self):
        budget = get_or_create_budget("exhaust_test", max_tokens=10)
        budget.consume(10)
        assert budget.is_exhausted
        assert budget.remaining == 0
