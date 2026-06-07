from __future__ import annotations

import pytest

from app.workflow.fsm import NodeState
from app.workflow.executors.ifelse import (
    execute_ifelse_node,
    _evaluate_condition,
    resolve_branch,
)


class TestConditionEvaluation:
    def test_equals_match(self):
        assert _evaluate_condition(
            {"field": "status", "operator": "equals", "value": "ok"},
            {"status": "ok"},
        ) is True

    def test_equals_no_match(self):
        assert _evaluate_condition(
            {"field": "status", "operator": "equals", "value": "ok"},
            {"status": "error"},
        ) is False

    def test_contains_match(self):
        assert _evaluate_condition(
            {"field": "text", "operator": "contains", "value": "python"},
            {"text": "I love Python programming"},
        ) is True

    def test_regex_match(self):
        assert _evaluate_condition(
            {"field": "code", "operator": "regex", "value": r"\d{3}"},
            {"code": "error code 500 occurred"},
        ) is True

    def test_gt_match(self):
        assert _evaluate_condition(
            {"field": "score", "operator": "gt", "value": "0.5"},
            {"score": "0.8"},
        ) is True

    def test_lt_match(self):
        assert _evaluate_condition(
            {"field": "score", "operator": "lt", "value": "0.5"},
            {"score": "0.2"},
        ) is True

    def test_nested_field_access(self):
        assert _evaluate_condition(
            {"field": "result.score", "operator": "equals", "value": "high"},
            {"result": {"score": "high"}},
        ) is True


class TestBranchResolution:
    def test_resolves_true_branch(self):
        result = resolve_branch(
            [{"field": "x", "operator": "equals", "value": "1"}],
            "and",
            {"x": "1"},
        )
        assert result == "true"

    def test_resolves_false_branch(self):
        result = resolve_branch(
            [{"field": "x", "operator": "equals", "value": "1"}],
            "and",
            {"x": "2"},
        )
        assert result == "false"


class TestIfElseExecutor:
    @pytest.mark.asyncio
    async def test_emits_branch_decision(self):
        node_state = NodeState(node_id="if1", node_type="ifelse")
        config = {"conditions": [{"field": "x", "operator": "equals", "value": "yes"}], "logic": "and"}
        upstream = {"x": "yes"}

        events = []
        async for event in execute_ifelse_node(node_state, config, upstream):
            events.append(event)

        assert node_state.status == "SUCCESS"
        assert node_state.output is not None
        assert node_state.output["branch"] == "true"
        assert len(events) == 2
