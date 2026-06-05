import os

from app.guardrail.check_input import check_input_guardrail


def test_input_allows_when_disabled(monkeypatch):
    monkeypatch.setenv("GUARDRAIL_ENABLED", "false")
    assert check_input_guardrail("hello") == {"blocked": False}


def test_input_blocks_empty_when_enabled(monkeypatch):
    monkeypatch.setenv("GUARDRAIL_ENABLED", "true")
    result = check_input_guardrail("   ")
    assert result["blocked"] is True
    assert result["reason"] == "empty prompt"
