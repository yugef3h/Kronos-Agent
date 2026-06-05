import os

from app.guardrail.check_input import check_input_guardrail


def test_input_blocks_phone_pattern(monkeypatch):
    monkeypatch.setenv("GUARDRAIL_ENABLED", "true")
    result = check_input_guardrail("联系 13800138000")
    assert result["blocked"] is True
