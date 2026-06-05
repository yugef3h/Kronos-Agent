from app.tools.agent_hint import build_playground_agent_system_hint
from app.tools.registry import build_tool_registry


def test_agent_hint_when_web_search_enabled():
    registry = build_tool_registry("test-key")
    hint = build_playground_agent_system_hint(registry)
    assert hint is not None
    assert "web_search" in hint
