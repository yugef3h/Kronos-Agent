from __future__ import annotations

from app.tools.registry import PlaygroundToolRegistry
from app.tools.web_search import WEB_SEARCH_TOOL_NAME


def build_playground_agent_system_hint(registry: PlaygroundToolRegistry) -> str | None:
    if WEB_SEARCH_TOOL_NAME not in registry:
        return None

    return "\n".join(
        [
            "You are a Playground assistant with tools.",
            "Available tools:",
            "- web_search: live web search for news, prices, weather, releases, and time-sensitive facts.",
            "Rules:",
            "- When the user needs up-to-date or external facts, you MUST call web_search before answering.",
            "- Do not guess dates, prices, or news headlines without searching first.",
            "- Use a concise search query in the user language.",
            "- Skip web_search only for pure reasoning, coding, or translation without needing live data.",
        ]
    )
