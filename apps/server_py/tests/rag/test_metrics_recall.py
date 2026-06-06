from app.rag.metrics import recall_at_k


def test_recall_at_k_counts_hits_in_top_k():
    relevant = {"a", "b", "c"}
    retrieved = ["x", "a", "b", "y"]
    assert recall_at_k(relevant, retrieved, 2) == 1 / 3
