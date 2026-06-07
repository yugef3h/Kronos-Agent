from __future__ import annotations

import pytest

from app.workflow.fsm import NodeState
from app.workflow.executors.start_node import execute_start_node


class TestStartExecutor:
    @pytest.mark.asyncio
    async def test_emits_node_start_and_end_events(self):
        node_state = NodeState(node_id="s1", node_type="start")
        config = {"label": "Test Start"}
        workflow_input = {"prompt": "hello"}

        events = []
        async for event in execute_start_node(node_state, config, workflow_input):
            events.append(event)

        assert node_state.status == "SUCCESS"
        assert len(events) == 2
        assert events[0]["type"] == "node_start"
        assert events[1]["type"] == "node_end"

    @pytest.mark.asyncio
    async def test_output_contains_input(self):
        node_state = NodeState(node_id="s1", node_type="start")
        config = {}
        workflow_input = {"prompt": "test input"}

        async for event in execute_start_node(node_state, config, workflow_input):
            pass

        assert node_state.output is not None
        assert node_state.output["input"] == workflow_input
