from __future__ import annotations

import pytest

from app.mcp.server import _tool_registry, _tool_handlers, register_tool, list_tools, call_tool


class TestMCPToolRegistry:
    def teardown_method(self):
        _tool_registry.clear()
        _tool_handlers.clear()

    def test_register_and_list_tool(self):
        async def dummy_handler(args):
            return {"result": "ok"}

        register_tool(
            name="test_tool",
            description="A test tool",
            input_schema={"type": "object", "properties": {}},
            handler=dummy_handler,
        )
        tools = list_tools()
        assert len(tools) == 1
        assert tools[0]["name"] == "test_tool"

    @pytest.mark.asyncio
    async def test_call_tool_returns_result(self):
        async def echo_handler(args):
            return {"echo": args.get("message", "")}

        register_tool(
            name="echo",
            description="Echo tool",
            input_schema={"type": "object", "properties": {"message": {"type": "string"}}},
            handler=echo_handler,
        )
        result = await call_tool("echo", {"message": "hello"})
        assert "content" in result
        assert "hello" in result["content"][0]["text"]

    @pytest.mark.asyncio
    async def test_call_unknown_tool_returns_error(self):
        result = await call_tool("nonexistent", {})
        assert result.get("isError") is True

    @pytest.mark.asyncio
    async def test_call_tool_with_exception(self):
        async def failing_handler(args):
            raise ValueError("test error")

        register_tool(
            name="failing",
            description="Always fails",
            input_schema={"type": "object", "properties": {}},
            handler=failing_handler,
        )
        result = await call_tool("failing", {})
        assert result.get("isError") is True
