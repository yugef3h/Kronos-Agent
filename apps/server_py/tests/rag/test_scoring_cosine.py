import pytest

from app.rag.scoring import cosine_similarity


def test_cosine_identical_vectors_score_one():
    vector = [1.0, 0.0, 1.0]
    assert cosine_similarity(vector, vector) == pytest.approx(1.0)
