from __future__ import annotations

TERMINAL_WORKFLOW_STATUSES = {"SUCCESS", "FAILED", "CANCELLED"}
TERMINAL_NODE_STATUSES = {"SUCCESS", "FAILED", "SKIPPED"}


def is_terminal_workflow_status(status: str) -> bool:
    return status in TERMINAL_WORKFLOW_STATUSES


def is_terminal_node_status(status: str) -> bool:
    return status in TERMINAL_NODE_STATUSES
