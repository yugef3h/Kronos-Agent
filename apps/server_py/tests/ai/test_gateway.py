from __future__ import annotations

import os
import pytest

from app.ai.gateway import (
    resolve_model_by_intent,
    resolve_model_by_tier,
    get_gateway_health,
)


def _requires_env():
    if not os.getenv("DOUBAO_API_KEY"):
        pytest.skip("DOUBAO_API_KEY not set")


class TestGateway:
    def test_resolve_model_by_intent_returns_string(self):
        _requires_env()
        model = resolve_model_by_intent("chat")
        assert isinstance(model, str)
        assert len(model) > 0

    def test_resolve_model_by_intent_code(self):
        _requires_env()
        model = resolve_model_by_intent("code")
        assert isinstance(model, str)

    def test_resolve_model_by_intent_unknown(self):
        _requires_env()
        model = resolve_model_by_intent("unknown_intent")
        assert isinstance(model, str)

    def test_resolve_model_by_tier_min_0(self):
        _requires_env()
        model = resolve_model_by_tier(min_tier=0)
        assert isinstance(model, str)

    def test_gateway_health(self):
        _requires_env()
        health = get_gateway_health()
        assert isinstance(health, dict)
        assert "primary_model" in health
        assert "ready" in health
        assert isinstance(health["ready"], bool)
