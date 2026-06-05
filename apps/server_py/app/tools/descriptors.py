from __future__ import annotations

from typing import TypedDict

from langchain_core.tools import StructuredTool

from app.config import get_settings
from app.tools.registry import build_tool_registry, list_registry_tools


class PlaygroundToolDescriptor(TypedDict):
    name: str
    description: str
    parameters: dict
    enabled: bool


def describe_registry_tool(tool: StructuredTool) -> PlaygroundToolDescriptor:
    parameters: dict = {"type": "object", "properties": {}}
    if tool.args_schema is not None:
        parameters = tool.args_schema.model_json_schema()

    return {
        "name": tool.name,
        "description": tool.description or "",
        "parameters": parameters,
        "enabled": True,
    }


def list_playground_tool_descriptors(
    registry: dict[str, StructuredTool] | None = None,
) -> list[PlaygroundToolDescriptor]:
    settings = get_settings()
    active_registry = registry or build_tool_registry(settings.tavily_api_key)
    return [describe_registry_tool(tool) for tool in list_registry_tools(active_registry)]


def list_configured_playground_tool_descriptors() -> dict:
    settings = get_settings()
    configured = build_tool_registry(settings.tavily_api_key)
    return {
        "tools": list_playground_tool_descriptors(configured),
        "configuredToolNames": list(configured.keys()),
    }
