import os

from app.guardrail.config import is_guardrail_enabled


def test_guardrail_disabled_by_default(monkeypatch):
    monkeypatch.delenv("GUARDRAIL_ENABLED", raising=False)
    assert is_guardrail_enabled() is False


def test_guardrail_enabled_flag(monkeypatch):
    monkeypatch.setenv("GUARDRAIL_ENABLED", "true")
    assert is_guardrail_enabled() is True
