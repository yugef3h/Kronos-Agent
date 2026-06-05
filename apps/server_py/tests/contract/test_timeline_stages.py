from app.agent.timeline import create_timeline_event


def test_timeline_stages_plan_reason_tool():
    plan = create_timeline_event("plan", "start", "plan")
    reason = create_timeline_event("reason", "start", "reason")
    tool = create_timeline_event("tool", "start", "tool", tool_name="web_search")
    assert plan["stage"] == "plan"
    assert reason["stage"] == "reason"
    assert tool["stage"] == "tool"
