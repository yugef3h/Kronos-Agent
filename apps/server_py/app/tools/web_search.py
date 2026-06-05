from __future__ import annotations

import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from app.tools.format_tavily import TavilySearchHit, format_tavily_results_for_llm

WEB_SEARCH_TOOL_NAME = "web_search"


class WebSearchInput(BaseModel):
    query: str = Field(
        min_length=1,
        description="Concise search query in the user language.",
    )


async def _tavily_search(query: str, api_key: str) -> list[TavilySearchHit]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": 5,
                "search_depth": "basic",
            },
        )
        response.raise_for_status()
        payload = response.json()
        return list(payload.get("results") or [])


def create_web_search_tool(api_key: str) -> StructuredTool:
    async def _run(query: str) -> str:
        trimmed = query.strip()
        if not trimmed:
            return "web_search: empty query"
        results = await _tavily_search(trimmed, api_key)
        return format_tavily_results_for_llm(trimmed, results)

    return StructuredTool.from_function(
        coroutine=_run,
        name=WEB_SEARCH_TOOL_NAME,
        description=(
            "Search the live web for current events, news, prices, weather, product "
            "releases, and any time-sensitive facts. Use when the user asks about "
            '"today", "latest", "now", or specific dates after your knowledge cutoff.'
        ),
        args_schema=WebSearchInput,
    )
