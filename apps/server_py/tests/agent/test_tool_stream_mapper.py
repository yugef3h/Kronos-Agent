from langchain_core.messages import AIMessage, ToolMessage

from app.agent.tool_stream_mapper import map_langgraph_update_to_timeline_events


def test_tool_mapper_emits_tool_start_events():
    message = AIMessage(
        content="",
        tool_calls=[{"name": "web_search", "args": {"query": "news"}, "id": "1"}],
    )
    events = map_langgraph_update_to_timeline_events("agent", [message])
    assert len(events) == 1
    assert events[0]["stage"] == "tool"
    assert events[0]["status"] == "start"
    assert events[0]["toolName"] == "web_search"


def test_tool_mapper_emits_tool_end_events():
    message = ToolMessage(content="done", name="web_search", tool_call_id="1")
    events = map_langgraph_update_to_timeline_events("tools", [message])
    assert len(events) == 1
    assert events[0]["status"] == "end"
    assert events[0]["toolOutput"] == "done"
