from __future__ import annotations

import math
import re
from typing import Sequence

_TOKEN_RE = re.compile(r"[a-zA-Z0-9_]+|[\u4e00-\u9fff]")


def tokenize_for_bm25(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def merge_hybrid_scores(
    keyword_score: float,
    semantic_score: float,
    *,
    keyword_weight: float = 0.4,
    semantic_weight: float = 0.6,
) -> float:
    return keyword_score * keyword_weight + semantic_score * semantic_weight
