"""Workflow draft runner — orchestrates node execution in graph order."""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any, AsyncIterator, Optional

from app.workflow.fsm import (
    WorkflowState,
    NodeState,
    create_workflow_state,
    is_terminal_node_status,
)
from app.workflow.types import WorkflowGraph, WorkflowRunSummary
from app.workflow.sse import format_workflow_run_event_sse

logger = logging.getLogger(__name__)

EXECUTOR_MAP: dict[str, Any] = {}


def _lazy_load_executors() -> None:
    """Lazy-load executor modules to avoid circular imports."""
    if EXECUTOR_MAP:
        return
    from app.workflow.executors.start_node import execute_start_node
    from app.workflow.executors.end_node import execute_end_node
    from app.workflow.executors.llm import execute_llm_node
    from app.workflow.executors.knowledge import execute_knowledge_node
    from app.workflow.executors.ifelse import execute_ifelse_node

    EXECUTOR_MAP.update({
        "start": execute_start_node,
        "end": execute_end_node,
        "llm": execute_llm_node,
        "knowledge": execute_knowledge_node,
        "ifelse": execute_ifelse_node,
    })


def _resolve_next_node(
    graph: WorkflowGraph,
    current_node_id: str,
    node_output: Optional[dict],
) -> Optional[str]:
    """Determine the next node to execute based on graph edges."""
    outgoing = graph.get_outgoing_edges(current_node_id)
    if not outgoing:
        return None

    # IfElse routing: check branch
    if node_output and "branch" in node_output:
        branch_target = node_output["branch"]
        for edge in outgoing:
            if edge.condition == branch_target:
                return edge.target

    # Default: first outgoing edge
    return outgoing[0].target


async def run_workflow_draft(
    graph: WorkflowGraph,
    workflow_input: dict,
    *,
    run_id: Optional[str] = None,
    chat_model=None,
) -> AsyncIterator[str]:
    """Run a workflow draft, yielding SSE-formatted events.

    Executes nodes in topological order, handling branching from IfElse
    and streaming content from LLM nodes.
    """
    _lazy_load_executors()
    run_id = run_id or str(uuid.uuid4())[:8]
    workflow_id = run_id

    node_ids = [n.node_id for n in graph.nodes]
    node_types = {n.node_id: n.node_type for n in graph.nodes}
    state = create_workflow_state(workflow_id, node_ids, node_types)

    state.transition_to("RUNNING")
    state.started_at = time.time()

    accumulated_output: dict = {"input": workflow_input}
    current_node_id: Optional[str] = None

    # Find start node
    start_nodes = graph.start_nodes()
    if start_nodes:
        current_node_id = start_nodes[0].node_id

    logger.info("Workflow draft run start: run_id=%s nodes=%d", run_id, len(node_ids))

    event_id = 0

    while current_node_id and not state.is_terminal():
        node_state = state.get_node(current_node_id)
        if node_state is None:
            break

        node_config_obj = graph.get_node(current_node_id)
        node_config = node_config_obj.config if node_config_obj else {}
        executor_key = node_state.node_type
        executor = EXECUTOR_MAP.get(executor_key)

        if executor is None:
            logger.warning("No executor for node type %s, skipping", executor_key)
            node_state.transition_to("SKIPPED")
            current_node_id = _resolve_next_node(graph, current_node_id, node_state.output)
            continue

        try:
            async for event in executor(node_state, node_config, accumulated_output):
                event["run_id"] = run_id
                event["workflow_id"] = workflow_id
                event_id += 1
                state.event_count = event_id
                yield format_workflow_run_event_sse(event, event_id)

                if event.get("type") == "node_end":
                    if node_state.output:
                        accumulated_output["last_response"] = node_state.output.get("response", "")
                        accumulated_output["knowledge_context"] = node_state.output.get("knowledge_context", "")
                        accumulated_output[f"node_{current_node_id}_output"] = node_state.output

        except Exception as exc:
            logger.error("Node %s execution failed: %s", current_node_id, exc)
            node_state.error = str(exc)[:500]
            node_state.transition_to("FAILED")
            node_state.completed_at = time.time()
            event_id += 1
            yield format_workflow_run_event_sse({
                "type": "node_end",
                "node_id": current_node_id,
                "node_type": node_state.node_type,
                "status": "FAILED",
                "error": node_state.error,
                "run_id": run_id,
                "timestamp": int(time.time() * 1000),
            }, event_id)
            state.error = f"Node {current_node_id} failed: {node_state.error}"
            state.transition_to("FAILED")
            break

        if is_terminal_node_status(node_state.status) and node_state.status == "FAILED":
            state.transition_to("FAILED")
            state.error = f"Node {current_node_id} failed"
            break

        current_node_id = _resolve_next_node(graph, current_node_id, node_state.output)

    # Determine final status
    if not state.is_terminal():
        state.transition_to("SUCCESS" if not state.error else "FAILED")
    state.completed_at = time.time()

    # Emit complete event
    event_id += 1
    summary = WorkflowRunSummary(
        run_id=run_id,
        workflow_id=workflow_id,
        status=state.status,
        node_count=len(node_ids),
        completed_nodes=sum(1 for n in state.nodes.values() if n.status == "SUCCESS"),
        failed_nodes=sum(1 for n in state.nodes.values() if n.status == "FAILED"),
        started_at=state.started_at,
        completed_at=state.completed_at,
        error=state.error,
    )
    yield format_workflow_run_event_sse({
        "type": "complete",
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": state.status,
        "summary": {
            "run_id": summary.run_id,
            "status": summary.status,
            "node_count": summary.node_count,
            "completed_nodes": summary.completed_nodes,
            "failed_nodes": summary.failed_nodes,
        },
        "timestamp": int(time.time() * 1000),
    }, event_id)

    logger.info(
        "Workflow draft run complete: run_id=%s status=%s nodes=%d/%d",
        run_id, state.status, summary.completed_nodes, summary.node_count,
    )
