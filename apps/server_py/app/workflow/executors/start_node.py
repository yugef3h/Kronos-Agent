"""Start node executor — emits the workflow begin event and passes input forward."""

from __future__ import annotations

import time
from typing import AsyncIterator

from app.workflow.fsm import NodeState


async def execute_start_node(
    node_state: NodeState,
    node_config: dict,
    workflow_input: dict,
) -> AsyncIterator[dict]:
    """Execute a Start node — emits a timeline event and passes input downstream."""
    node_state.transition_to("RUNNING")
    node_state.started_at = time.time()

    yield {
        "type": "node_start",
        "node_id": node_state.node_id,
        "node_type": "start",
        "stage": "plan",
        "status": "info",
        "message": f"Workflow started: {node_config.get('label', node_state.node_id)}",
        "timestamp": int(time.time() * 1000),
        "input": workflow_input,
    }

    node_state.output = {"input": workflow_input}
    node_state.transition_to("SUCCESS")
    node_state.completed_at = time.time()

    yield {
        "type": "node_end",
        "node_id": node_state.node_id,
        "node_type": "start",
        "status": "SUCCESS",
        "timestamp": int(time.time() * 1000),
        "output": node_state.output,
    }
