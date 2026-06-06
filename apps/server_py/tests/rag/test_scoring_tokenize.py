from app.rag.scoring import tokenize_for_bm25


def test_tokenize_splits_ascii_words():
    tokens = tokenize_for_bm25("Hello World API_key")
    assert "hello" in tokens
    assert "world" in tokens
    assert "api_key" in tokens
