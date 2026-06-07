from __future__ import annotations

import pytest

from app.workflow.fsm import (
    WorkflowState,
    NodeState,
    create_workflow_state,
    is_valid_workflow_transition,
    is_valid_node_transition,
    is_terminal_workflow_status,
    is_terminal_node_status,
)


class TestWorkflowTransitions:
    def test_pending_to_running_valid(self):
        assert is_valid_workflow_transition("PENDING", "RUNNING") is True

    def test_running_to_success_valid(self):
        assert is_valid_workflow_transition("RUNNING", "SUCCESS") is True

    def test_running_to_failed_valid(self):
        assert is_valid_workflow_transition("RUNNING", "FAILED") is True

    def test_running_to_cancelled_valid(self):
        assert is_valid_workflow_transition("RUNNING", "CANCELLED") is True

    def test_terminal_rejects_transitions(self):
        for status in ("SUCCESS", "FAILED", "CANCELLED"):
            assert is_valid_workflow_transition(status, "RUNNING") is False
            assert is_terminal_workflow_status(status) is True

    def test_node_pending_to_skipped_valid(self):
        assert is_valid_node_transition("PENDING", "SKIPPED") is True

    def test_node_running_to_failed_valid(self):
        assert is_valid_node_transition("RUNNING", "FAILED") is True


class TestWorkflowState:
    def test_transition_to_valid_status(self):
        state = WorkflowState(workflow_id="wf1")
        assert state.status == "PENDING"
        state.transition_to("RUNNING")
        assert state.status == "RUNNING"

    def test_transition_invalid_raises(self):
        state = WorkflowState(workflow_id="wf1")
        state.transition_to("RUNNING")
        state.transition_to("SUCCESS")
        with pytest.raises(ValueError):
            state.transition_to("RUNNING")

    def test_is_terminal(self):
        state = WorkflowState(workflow_id="wf1")
        assert not state.is_terminal()
        state.transition_to("RUNNING")
        state.transition_to("SUCCESS")
        assert state.is_terminal()

    def test_active_nodes_returns_pending_and_running(self):
        state = create_workflow_state("wf1", ["n1", "n2", "n3"], {"n1": "start", "n2": "llm", "n3": "end"})
        assert len(state.active_nodes()) == 3
        state.get_node("n1").transition_to("SUCCESS")
        assert len(state.active_nodes()) == 2

    def test_next_pending_node(self):
        state = create_workflow_state("wf1", ["n1", "n2"], {"n1": "start", "n2": "llm"})
        next_node = state.next_pending_node()
        assert next_node is not None
        assert next_node.node_id == "n1"


class TestNodeState:
    def test_transition_to_valid(self):
        node = NodeState(node_id="n1", node_type="llm")
        node.transition_to("RUNNING")
        assert node.status == "RUNNING"

    def test_retry_count_tracks(self):
        node = NodeState(node_id="n1", node_type="llm", retry_count=2)
        assert node.retry_count == 2
