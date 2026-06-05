import os

import pytest

from app.agent.timeline import create_timeline_event


@pytest.mark.asyncio
async def test_router_uses_linear_when_langgraph_disabled(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_ENABLED", "false")
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-32chars-minimum")
    monkeypatch.setenv("DOUBAO_API_KEY", "test-key")
    monkeypatch.setenv("DOUBAO_BASE_URL", "https://example.com")
    monkeypatch.setenv("DOUBAO_MODEL", "test-model")

    from app.config import get_settings

    get_settings.cache_clear()

    async def fake_linear_reply(**_kwargs):
        yield create_timeline_event("plan", "start", "linear path")
        yield {"type": "content", "content": "ok"}

    monkeypatch.setattr("app.agent.router.stream_linear_chat_reply", fake_linear_reply)

    from app.agent.router import stream_playground_agent_reply

    events = []
    async for event in stream_playground_agent_reply(
        prompt="hello",
        history=[],
        session_id="test-session",
    ):
        events.append(event)

    get_settings.cache_clear()
    assert any(event.get("stage") == "plan" for event in events if event.get("type") == "timeline")
