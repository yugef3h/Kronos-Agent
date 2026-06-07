"""MCP stdio server — exposes Kronos tools via Model Context Protocol."""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Tool registry — populated at startup
_tool_registry: dict[str, dict] = {}
_tool_handlers: dict[str, Any] = {}


def register_tool(name: str, description: str, input_schema: dict, handler):
    """Register an MCP tool with its handler function."""
    _tool_registry[name] = {
        "name": name,
        "description": description,
        "inputSchema": input_schema,
    }
    _tool_handlers[name] = handler
    logger.info("MCP tool registered: %s", name)


def list_tools() -> list[dict]:
    """Return all registered MCP tool definitions."""
    return list(_tool_registry.values())


async def call_tool(name: str, arguments: dict) -> dict:
    """Invoke a registered tool by name with given arguments."""
    handler = _tool_handlers.get(name)
    if handler is None:
        return {
            "content": [{"type": "text", "text": f"Tool not found: {name}"}],
            "isError": True,
        }

    try:
        result = await handler(arguments)
        return {
            "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, default=str)}],
        }
    except Exception as exc:
        logger.error("MCP tool %s failed: %s", name, exc)
        return {
            "content": [{"type": "text", "text": f"Tool error: {exc}"}],
            "isError": True,
        }


def _load_tools() -> None:
    """Lazy-load and register all built-in MCP tools."""
    if _tool_registry:
        return
    try:
        from app.mcp.tools.knowledge import register as reg_knowledge
        reg_knowledge()
    except ImportError:
        pass
    try:
        from app.mcp.tools.crawler import register as reg_crawler
        reg_crawler()
    except ImportError:
        pass


async def _handle_request(request: dict) -> Optional[dict]:
    """Process a single JSON-RPC MCP request."""
    method = request.get("method", "")
    req_id = request.get("id")

    if method == "tools/list":
        _load_tools()
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"tools": list_tools()},
        }

    if method == "tools/call":
        _load_tools()
        params = request.get("params", {})
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})
        result = await call_tool(tool_name, arguments)
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": result,
        }

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "0.1.0",
                "serverInfo": {"name": "kronos-mcp", "version": "0.1.0"},
                "capabilities": {"tools": {}},
            },
        }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": -32601, "message": f"Method not found: {method}"},
    }


async def _read_stdin_loop() -> None:
    """Read JSON-RPC requests from stdin and write responses to stdout."""
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    transport, _ = await asyncio.get_event_loop().connect_read_pipe(
        lambda: protocol, sys.stdin
    )

    buffer = ""
    while True:
        try:
            chunk = await reader.read(4096)
            if not chunk:
                break
            buffer += chunk.decode("utf-8")

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue
                try:
                    request = json.loads(line)
                    response = await _handle_request(request)
                    if response:
                        sys.stdout.write(json.dumps(response) + "\n")
                        sys.stdout.flush()
                except json.JSONDecodeError as exc:
                    logger.warning("MCP invalid JSON: %s", exc)
        except Exception as exc:
            logger.error("MCP stdin loop error: %s", exc)
            break


def main() -> None:
    """Entry point for the MCP stdio server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [mcp] %(levelname)s %(message)s",
        stream=sys.stderr,
    )
    logger.info("Kronos MCP server starting...")
    try:
        asyncio.run(_read_stdin_loop())
    except KeyboardInterrupt:
        pass
    logger.info("Kronos MCP server stopped.")


if __name__ == "__main__":
    main()
