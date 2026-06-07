from __future__ import annotations

import json
import time
from typing import Optional


def format_workflow_run_event_sse(payload: dict, event_id: int) -> str:
    """Format a workflow run event as an SSE data line.

    Ensures all required fields are present for frontend consumption.
    """
    enriched = {
        "eventId": event_id,
        "timestamp": payload.get("timestamp", int(time.time() * 1000)),
        **payload,
    }
    body = json.dumps(enriched, ensure_ascii=False)
    return f"data: {body}\nid: {event_id}\n\n"


def format_node_event(
    *,
    event_type: str,
    node_id: str,
    node_type: str,
    status: str,
    run_id: str,
    workflow_id: str,
    message: str = "",
    output: Optional[dict] = None,
    error: Optional[str] = None,
    stage: str = "plan",
) -> dict:
    """Create a standardized node event payload."""
    payload: dict = {
        "type": event_type,
        "nodeId": node_id,
        "nodeType": node_type,
        "status": status,
        "runId": run_id,
        "workflowId": workflow_id,
        "stage": stage,
        "message": message,
        "timestamp": int(time.time() * 1000),
    }
    if output:
        payload["output"] = output
    if error:
        payload["error"] = error
    return payload


def format_timeline_event(
    *,
    stage: str,
    status: str,
    message: str,
    run_id: str,
    node_id: Optional[str] = None,
    tool_name: Optional[str] = None,
    tool_input: Optional[dict] = None,
    tool_output: Optional[str] = None,
    tool_error: Optional[str] = None,
) -> dict:
    """Create a timeline event payload matching the Node SSE contract."""
    payload: dict = {
        "type": "timeline",
        "stage": stage,
        "status": status,
        "message": message,
        "runId": run_id,
        "timestamp": int(time.time() * 1000),
    }
    if node_id:
        payload["nodeId"] = node_id
    if tool_name:
        payload["toolName"] = tool_name
    if tool_input:
        payload["toolInput"] = tool_input
    if tool_output:
        payload["toolOutput"] = tool_output
    if tool_error:
        payload["toolError"] = tool_error
    return payload


def format_content_event(
    content: str,
    run_id: str,
    *,
    node_id: Optional[str] = None,
) -> dict:
    """Create a content event payload."""
    payload: dict = {
        "type": "content",
        "content": content,
        "runId": run_id,
        "timestamp": int(time.time() * 1000),
    }
    if node_id:
        payload["nodeId"] = node_id
    return payload


def format_complete_event(
    run_id: str,
    workflow_id: str,
    status: str,
    *,
    summary: Optional[dict] = None,
) -> dict:
    """Create a workflow complete event payload."""
    payload: dict = {
        "type": "complete",
        "runId": run_id,
        "workflowId": workflow_id,
        "status": status,
        "timestamp": int(time.time() * 1000),
    }
    if summary:
        payload["summary"] = summary
    return payload
