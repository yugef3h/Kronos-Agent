from app.workflow.fsm import is_terminal_node_status, is_terminal_workflow_status


def test_fsm_terminal_states():
    assert is_terminal_workflow_status("SUCCESS") is True
    assert is_terminal_node_status("SKIPPED") is True
