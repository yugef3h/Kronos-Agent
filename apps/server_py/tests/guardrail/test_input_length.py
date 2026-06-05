import os

from app.guardrail.check_input import check_input_guardrail


def test_input_blocks_over_max_chars(monkeypatch):
    monkeypatch.setenv("GUARDRAIL_ENABLED", "true")
    monkeypatch.setenv("GUARDRAIL_MAX_PROMPT_CHARS", "10")
    result = check_input_guardrail("x" * 11)
    assert result["blocked"] is True
    assert "exceeds 10 chars" in result["reason"]
