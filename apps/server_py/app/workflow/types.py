from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

WorkflowRunStatus = Literal["PENDING", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"]
NodeRunStatus = Literal["PENDING", "RUNNING", "SUCCESS", "FAILED", "SKIPPED"]

NodeType = Literal["start", "end", "llm", "knowledge", "ifelse", "loop", "iteration"]


@dataclass
class WorkflowEdge:
    source: str
    target: str
    condition: Optional[str] = None


@dataclass
class WorkflowNodeConfig:
    node_id: str
    node_type: NodeType
    label: str = ""
    config: dict = field(default_factory=dict)
    position: dict = field(default_factory=dict)


@dataclass
class WorkflowGraph:
    nodes: list[WorkflowNodeConfig]
    edges: list[WorkflowEdge]

    def get_node(self, node_id: str) -> Optional[WorkflowNodeConfig]:
        for node in self.nodes:
            if node.node_id == node_id:
                return node
        return None

    def get_outgoing_edges(self, node_id: str) -> list[WorkflowEdge]:
        return [e for e in self.edges if e.source == node_id]

    def get_incoming_edges(self, node_id: str) -> list[WorkflowEdge]:
        return [e for e in self.edges if e.target == node_id]

    def start_nodes(self) -> list[WorkflowNodeConfig]:
        return [n for n in self.nodes if n.node_type == "start"]


@dataclass
class WorkflowRunSummary:
    run_id: str
    workflow_id: str
    status: WorkflowRunStatus
    node_count: int
    completed_nodes: int
    failed_nodes: int
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    error: Optional[str] = None
