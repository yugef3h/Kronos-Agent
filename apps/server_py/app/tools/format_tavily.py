from __future__ import annotations

from typing import TypedDict


class TavilySearchHit(TypedDict, total=False):
    title: str
    url: str
    content: str
    score: float


def format_tavily_results_for_llm(query: str, results: list[TavilySearchHit]) -> str:
    if not results:
        return f"No web results found for query: {query}"

    lines: list[str] = []
    for index, item in enumerate(results):
        title = (item.get("title") or "").strip() or "Untitled"
        url = (item.get("url") or "").strip()
        snippet = (item.get("content") or "").strip()[:400]
        block = [f"[{index + 1}] {title}"]
        if url:
            block.append(f"URL: {url}")
        if snippet:
            block.append(f"Snippet: {snippet}")
        lines.append("\n".join(block))

    return "\n\n".join([f"Query: {query}", *lines])
