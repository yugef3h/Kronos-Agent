from __future__ import annotations

from typing import Dict, Optional

from langchain_core.tools import StructuredTool

from app.tools.web_search import WEB_SEARCH_TOOL_NAME, create_web_search_tool

PlaygroundToolRegistry = Dict[str, StructuredTool]


def build_tool_registry(tavily_api_key: Optional[str] = None) -> PlaygroundToolRegistry:
    registry: PlaygroundToolRegistry = {}
    key = (tavily_api_key or "").strip()
    if key:
        registry[WEB_SEARCH_TOOL_NAME] = create_web_search_tool(key)
    return registry


def list_registry_tools(registry: PlaygroundToolRegistry) -> list[StructuredTool]:
    return [tool for tool in registry.values() if tool is not None]
