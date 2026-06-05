import os

from app.guardrail.check_output import check_output_guardrail


def test_output_blocks_api_key_pattern(monkeypatch):
    monkeypatch.setenv("GUARDRAIL_ENABLED", "true")
    result = check_output_guardrail("api_key=secret")
    assert result["blocked"] is True
