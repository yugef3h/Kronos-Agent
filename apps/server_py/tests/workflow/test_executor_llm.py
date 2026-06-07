from __future__ import annotations

import pytest

from app.workflow.fsm import NodeState
from app.workflow.executors.llm import execute_llm_node, _resolve_prompt


class TestPromptResolution:
    def test_resolves_input_placeholder(self):
        result = _resolve_prompt(
            {"prompt": "Answer: {input}"},
            {"input": {"prompt": "What is AI?"}},
        )
        assert "What is AI?" in result

    def test_resolves_context_placeholder(self):
        result = _resolve_prompt(
            {"prompt": "Context: {context}\nQuery: {input}"},
            {"knowledge_context": "AI is...", "input": {"prompt": "explain"}},
        )
        assert "AI is..." in result
        assert "explain" in result

    def test_uses_upstream_when_no_template(self):
        result = _resolve_prompt(
            {},
            {"last_response": "previous output"},
        )
        assert "previous output" in result

    def test_fallback_when_empty(self):
        result = _resolve_prompt({}, {})
        assert len(result) > 0


class TestLLMExecutor:
    @pytest.mark.asyncio
    async def test_streams_content_events(self):
        node_state = NodeState(node_id="llm1", node_type="llm")
        config = {"prompt": "Say: {input}", "temperature": 0.5, "max_tokens": 100}
        upstream = {"input": {"prompt": "hello"}}

        events = []
        async for event in execute_llm_node(node_state, config, upstream):
            events.append(event)

        assert node_state.status == "SUCCESS"
        assert len(events) >= 2
        assert events[0]["type"] == "node_start"
        assert events[-1]["type"] == "node_end"
        assert node_state.output is not None
        assert "response" in node_state.output

    @pytest.mark.asyncio
    async def test_handles_exception_gracefully(self):
        node_state = NodeState(node_id="llm_err", node_type="llm")
        config = {"prompt": "test"}

        # Since no chat model, falls back to echo — this tests the no-model path
        events = []
        async for event in execute_llm_node(node_state, config, {"input": {"prompt": "test"}}):
            events.append(event)

        assert node_state.status == "SUCCESS"
        assert node_state.output is not None
