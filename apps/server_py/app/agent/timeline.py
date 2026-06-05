from __future__ import annotations

import time
from typing import Literal, Optional, TypedDict


TimelineStage = Literal["plan", "reason", "tool"]
TimelineStatus = Literal["start", "end", "info"]


class TimelineEvent(TypedDict, total=False):
    type: Literal["timeline"]
    stage: TimelineStage
    status: TimelineStatus
    message: str
    toolName: str
    toolInput: str
    toolOutput: str
    toolError: str
    timestamp: int


def create_timeline_event(
    stage: TimelineStage,
    status: TimelineStatus,
    message: str,
    tool_name: Optional[str] = None,
    tool_input: Optional[str] = None,
    tool_output: Optional[str] = None,
    tool_error: Optional[str] = None,
) -> TimelineEvent:
    event: TimelineEvent = {
        "type": "timeline",
        "stage": stage,
        "status": status,
        "message": message,
        "timestamp": int(time.time() * 1000),
    }
    if tool_name:
        event["toolName"] = tool_name
    if tool_input:
        event["toolInput"] = tool_input
    if tool_output:
        event["toolOutput"] = tool_output
    if tool_error:
        event["toolError"] = tool_error
    return event
