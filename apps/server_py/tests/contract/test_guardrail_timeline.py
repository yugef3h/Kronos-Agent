from app.guardrail.check_input import check_input_guardrail


def test_guardrail_blocked_yields_timeline_before_content(monkeypatch):
    monkeypatch.setenv("GUARDRAIL_ENABLED", "true")
    result = check_input_guardrail("   ")
    assert result["blocked"] is True
    assert result.get("reason")

    timeline = {
        "type": "timeline",
        "stage": "plan",
        "status": "info",
        "message": f"Guardrail 拦截：{result['reason']}",
    }
    content = {"type": "content", "content": "抱歉，该请求未通过安全校验，请修改后重试。"}
    assert timeline["type"] == "timeline"
    assert content["type"] == "content"
