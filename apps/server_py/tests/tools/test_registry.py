from app.tools.registry import build_tool_registry
from app.tools.web_search import WEB_SEARCH_TOOL_NAME


def test_registry_skips_without_api_key():
    registry = build_tool_registry(None)
    assert WEB_SEARCH_TOOL_NAME not in registry


def test_registry_includes_web_search_with_key():
    registry = build_tool_registry("test-key")
    assert WEB_SEARCH_TOOL_NAME in registry
