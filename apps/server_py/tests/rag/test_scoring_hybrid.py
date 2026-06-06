from app.rag.scoring import merge_hybrid_scores


def test_hybrid_merge_picks_higher_combined_score():
    low = merge_hybrid_scores(0.2, 0.2)
    high = merge_hybrid_scores(0.9, 0.9)
    assert high > low
