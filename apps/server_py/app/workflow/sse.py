from __future__ import annotations

import json


def format_workflow_run_event_sse(payload: dict, event_id: int) -> str:
    body = json.dumps(payload, ensure_ascii=False)
    return f"data: {body}\nid: {event_id}\n\n"
