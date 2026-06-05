from app.agent.timeline import create_timeline_event


def test_timeline_event_shape():
    event = create_timeline_event("plan", "start", "hello")
    assert event["type"] == "timeline"
    assert event["stage"] == "plan"
    assert event["status"] == "start"
    assert event["message"] == "hello"
    assert isinstance(event["timestamp"], int)
