from __future__ import annotations


def char_level_f1(prediction: str, reference: str) -> dict[str, float]:
    pred = "".join(prediction.split())
    ref = "".join(reference.split())
    if not ref:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}

    pred_counts: dict[str, int] = {}
    ref_counts: dict[str, int] = {}
    for char in pred:
        pred_counts[char] = pred_counts.get(char, 0) + 1
    for char in ref:
        ref_counts[char] = ref_counts.get(char, 0) + 1

    intersection = sum(min(ref_counts[c], pred_counts.get(c, 0)) for c in ref_counts)
    precision = intersection / len(pred) if pred else 0.0
    recall = intersection / len(ref) if ref else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}
