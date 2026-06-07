"""End node executor — collects workflow output and signals completion."""

from __future__ import annotations

import time
from typing import AsyncIterator

from app.workflow.fsm import NodeState


async def execute_end_node(
    node_state: NodeState,
    node_config: dict,
    accumulated_output: dict,
) -> AsyncIterator[dict]:
    """Execute an End node — aggregate outputs and emit completion."""
    node_state.transition_to("RUNNING")
    node_state.started_at = time.time()

    yield {
        "type": "node_start",
        "node_id": node_state.node_id,
        "node_type": "end",
        "stage": "plan",
        "status": "info",
        "message": "Workflow completing",
        "timestamp": int(time.time() * 1000),
    }

    node_state.output = {
        "final_output": accumulated_output.get("last_response", ""),
        "accumulated": accumulated_output,
    }
    node_state.transition_to("SUCCESS")
    node_state.completed_at = time.time()

    yield {
        "type": "node_end",
        "node_id": node_state.node_id,
        "node_type": "end",
        "status": "SUCCESS",
        "timestamp": int(time.time() * 1000),
        "output": node_state.output,
    }
