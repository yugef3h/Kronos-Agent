from app.rag.metrics import mean_reciprocal_rank


def test_mrr_returns_reciprocal_first_rank():
    relevant = {"b"}
    retrieved = ["a", "b", "c"]
    assert mean_reciprocal_rank(relevant, retrieved) == 0.5
