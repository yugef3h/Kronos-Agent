"""IfElse node executor — conditional branching based on upstream output."""

from __future__ import annotations

import logging
import re
import time
from typing import AsyncIterator

from app.workflow.fsm import NodeState

logger = logging.getLogger(__name__)


def _evaluate_condition(condition: dict, upstream_output: dict) -> bool:
    """Evaluate a single condition against upstream output."""
    field = condition.get("field", "")
    operator = condition.get("operator", "contains")
    value = condition.get("value", "")

    actual = upstream_output
    for key in field.split("."):
        if isinstance(actual, dict):
            actual = actual.get(key, "")
        else:
            actual = ""

    actual_str = str(actual)
    value_str = str(value)

    if operator == "equals":
        return actual_str == value_str
    elif operator == "not_equals":
        return actual_str != value_str
    elif operator == "contains":
        return value_str.lower() in actual_str.lower()
    elif operator == "regex":
        try:
            return bool(re.search(value_str, actual_str))
        except re.error:
            return False
    elif operator == "gt":
        try:
            return float(actual_str) > float(value_str)
        except (ValueError, TypeError):
            return False
    elif operator == "lt":
        try:
            return float(actual_str) < float(value_str)
        except (ValueError, TypeError):
            return False
    return False


def _evaluate_condition_group(conditions: list[dict], logic: str, upstream_output: dict) -> bool:
    """Evaluate a group of conditions with AND/OR logic."""
    if not conditions:
        return True

    results = [_evaluate_condition(c, upstream_output) for c in conditions]
    if logic == "and":
        return all(results)
    elif logic == "or":
        return any(results)
    return all(results)


def resolve_branch(conditions: list[dict], logic: str, upstream_output: dict) -> str:
    """Evaluate conditions and return the target branch identifier."""
    result = _evaluate_condition_group(conditions, logic, upstream_output)
    return "true" if result else "false"


async def execute_ifelse_node(
    node_state: NodeState,
    node_config: dict,
    upstream_output: dict,
) -> AsyncIterator[dict]:
    """Execute an IfElse node — evaluate condition and emit branch decision."""
    node_state.transition_to("RUNNING")
    node_state.started_at = time.time()

    conditions = node_config.get("conditions", [])
    logic = node_config.get("logic", "and")
    branch = resolve_branch(conditions, logic, upstream_output)

    node_state.output = {
        "branch": branch,
        "conditions_evaluated": len(conditions),
        "logic": logic,
    }

    yield {
        "type": "node_start",
        "node_id": node_state.node_id,
        "node_type": "ifelse",
        "stage": "plan",
        "status": "info",
        "message": f"Branch evaluation: conditions={len(conditions)} logic={logic} -> {branch}",
        "timestamp": int(time.time() * 1000),
    }

    node_state.transition_to("SUCCESS")
    node_state.completed_at = time.time()

    yield {
        "type": "node_end",
        "node_id": node_state.node_id,
        "node_type": "ifelse",
        "status": "SUCCESS",
        "timestamp": int(time.time() * 1000),
        "output": node_state.output,
    }
