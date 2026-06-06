from __future__ import annotations


def recall_at_k(relevant_ids: set[str], retrieved_ids: list[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    top = retrieved_ids[: max(k, 0)]
    hits = sum(1 for item_id in top if item_id in relevant_ids)
    return hits / len(relevant_ids)


def mean_reciprocal_rank(relevant_ids: set[str], retrieved_ids: list[str]) -> float:
    for index, item_id in enumerate(retrieved_ids, start=1):
        if item_id in relevant_ids:
            return 1.0 / index
    return 0.0
