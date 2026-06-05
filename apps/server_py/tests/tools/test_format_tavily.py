from app.tools.format_tavily import format_tavily_results_for_llm


def test_format_empty_results():
    text = format_tavily_results_for_llm("hello", [])
    assert "No web results found" in text


def test_format_results_with_snippet():
    text = format_tavily_results_for_llm(
        "news",
        [{"title": "Title", "url": "https://example.com", "content": "Snippet"}],
    )
    assert "Query: news" in text
    assert "Title" in text
    assert "Snippet" in text
