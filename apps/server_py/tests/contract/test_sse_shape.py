import json


def test_sse_data_line_json_shape():
    payload = {
        "type": "timeline",
        "stage": "plan",
        "status": "info",
        "message": "ok",
        "sessionId": "s1",
        "eventId": 1,
        "timestamp": 1,
    }
    line = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    assert line.startswith("data: ")
    parsed = json.loads(line.removeprefix("data: ").strip())
    assert parsed["type"] == "timeline"
