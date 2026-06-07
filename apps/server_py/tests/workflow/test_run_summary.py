from __future__ import annotations

import pytest

from app.workflow.types import (
    WorkflowGraph,
    WorkflowNodeConfig,
    WorkflowEdge,
    WorkflowRunSummary,
)

from app.workflow.fsm import (
    WorkflowState,
    NodeState,
    create_workflow_state,
)


def test_run_summary_shape_stub():
    summary = {"runId": "run_1", "status": "SUCCESS", "durationMs": 10}
    assert summary["status"] == "SUCCESS"


class TestRunSummary:
    def test_summary_fields(self):
        summary = WorkflowRunSummary(
            run_id="r1",
            workflow_id="wf1",
            status="SUCCESS",
            node_count=3,
            completed_nodes=3,
            failed_nodes=0,
        )
        assert summary.run_id == "r1"
        assert summary.status == "SUCCESS"
        assert summary.node_count == 3
        assert summary.completed_nodes == 3
        assert summary.failed_nodes == 0

    def test_summary_with_error(self):
        summary = WorkflowRunSummary(
            run_id="r2",
            workflow_id="wf2",
            status="FAILED",
            node_count=3,
            completed_nodes=1,
            failed_nodes=1,
            error="Node llm1 failed",
        )
        assert summary.error == "Node llm1 failed"


class TestWorkflowGraph:
    def test_graph_basics(self):
        nodes = [
            WorkflowNodeConfig(node_id="s", node_type="start"),
            WorkflowNodeConfig(node_id="l", node_type="llm", config={"prompt": "test"}),
            WorkflowNodeConfig(node_id="e", node_type="end"),
        ]
        edges = [
            WorkflowEdge(source="s", target="l"),
            WorkflowEdge(source="l", target="e"),
        ]
        graph = WorkflowGraph(nodes=nodes, edges=edges)

        assert graph.get_node("l") is not None
        assert len(graph.get_outgoing_edges("s")) == 1
        assert graph.get_outgoing_edges("s")[0].target == "l"
        assert len(graph.get_outgoing_edges("e")) == 0
        assert len(graph.get_incoming_edges("l")) == 1
        assert len(graph.start_nodes()) == 1

    def test_ifelse_graph_routing(self):
        nodes = [
            WorkflowNodeConfig(node_id="s", node_type="start"),
            WorkflowNodeConfig(node_id="if1", node_type="ifelse"),
            WorkflowNodeConfig(node_id="l1", node_type="llm"),
            WorkflowNodeConfig(node_id="l2", node_type="llm"),
        ]
        edges = [
            WorkflowEdge(source="s", target="if1"),
            WorkflowEdge(source="if1", target="l1", condition="true"),
            WorkflowEdge(source="if1", target="l2", condition="false"),
        ]
        graph = WorkflowGraph(nodes=nodes, edges=edges)

        if_edges = graph.get_outgoing_edges("if1")
        assert len(if_edges) == 2
        conditions = {e.condition for e in if_edges}
        assert conditions == {"true", "false"}
