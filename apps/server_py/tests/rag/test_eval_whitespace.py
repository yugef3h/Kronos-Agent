from app.rag.eval import char_level_f1


def test_char_level_f1_ignores_whitespace():
    metrics = char_level_f1("a b c", "abc")
    assert metrics["f1"] == 1.0
