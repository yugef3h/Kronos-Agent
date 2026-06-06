import json


def test_complete_event_includes_session_id():
    payload = {"type": "complete", "sessionId": "sess-42", "eventId": 9}
    line = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    parsed = json.loads(line.removeprefix("data: ").strip())
    assert parsed["type"] == "complete"
    assert parsed["sessionId"] == "sess-42"
    assert "eventId" in parsed
