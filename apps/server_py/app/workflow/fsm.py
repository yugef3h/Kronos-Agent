from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from app.workflow.types import WorkflowRunStatus, NodeRunStatus

TERMINAL_WORKFLOW_STATUSES: frozenset[str] = frozenset({"SUCCESS", "FAILED", "CANCELLED"})
TERMINAL_NODE_STATUSES: frozenset[str] = frozenset({"SUCCESS", "FAILED", "SKIPPED"})

_WORKFLOW_TRANSITIONS: dict[str, set[str]] = {
    "PENDING": {"RUNNING", "CANCELLED"},
    "RUNNING": {"SUCCESS", "FAILED", "CANCELLED"},
    "SUCCESS": set(),
    "FAILED": set(),
    "CANCELLED": set(),
}

_NODE_TRANSITIONS: dict[str, set[str]] = {
    "PENDING": {"RUNNING", "SKIPPED"},
    "RUNNING": {"SUCCESS", "FAILED", "SKIPPED"},
    "SUCCESS": set(),
    "FAILED": set(),
    "SKIPPED": set(),
}


def is_terminal_workflow_status(status: str) -> bool:
    return status in TERMINAL_WORKFLOW_STATUSES


def is_terminal_node_status(status: str) -> bool:
    return status in TERMINAL_NODE_STATUSES


def is_valid_workflow_transition(from_status: str, to_status: str) -> bool:
    allowed = _WORKFLOW_TRANSITIONS.get(from_status, set())
    return to_status in allowed


def is_valid_node_transition(from_status: str, to_status: str) -> bool:
    allowed = _NODE_TRANSITIONS.get(from_status, set())
    return to_status in allowed


@dataclass
class NodeState:
    node_id: str
    node_type: str
    status: NodeRunStatus = "PENDING"
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
    output: Optional[dict] = None
    retry_count: int = 0

    def transition_to(self, new_status: NodeRunStatus) -> None:
        if not is_valid_node_transition(self.status, new_status):
            raise ValueError(
                f"invalid node transition {self.node_id}: {self.status} -> {new_status}"
            )
        self.status = new_status


@dataclass
class WorkflowState:
    workflow_id: str
    status: WorkflowRunStatus = "PENDING"
    nodes: dict[str, NodeState] = field(default_factory=dict)
    current_node_id: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
    event_count: int = 0

    def transition_to(self, new_status: WorkflowRunStatus) -> None:
        if not is_valid_workflow_transition(self.status, new_status):
            raise ValueError(
                f"invalid workflow transition {self.workflow_id}: {self.status} -> {new_status}"
            )
        self.status = new_status

    def is_terminal(self) -> bool:
        return is_terminal_workflow_status(self.status)

    def get_node(self, node_id: str) -> Optional[NodeState]:
        return self.nodes.get(node_id)

    def add_node(self, node: NodeState) -> None:
        self.nodes[node.node_id] = node

    def active_nodes(self) -> list[NodeState]:
        return [n for n in self.nodes.values() if n.status in ("PENDING", "RUNNING")]

    def next_pending_node(self) -> Optional[NodeState]:
        for node in self.nodes.values():
            if node.status == "PENDING":
                return node
        return None


def create_workflow_state(workflow_id: str, node_ids: list[str], node_types: dict[str, str]) -> WorkflowState:
    """Create a new workflow state with pending nodes."""
    state = WorkflowState(workflow_id=workflow_id)
    for node_id in node_ids:
        state.add_node(NodeState(
            node_id=node_id,
            node_type=node_types.get(node_id, "unknown"),
        ))
    return state
