from __future__ import annotations

import hashlib
import math
import os
from threading import Lock
from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field


ATTENTION_MODEL_NAME = os.getenv(
    "ATTENTION_PY_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
ATTENTION_FALLBACK_DIM = max(16, int(os.getenv("ATTENTION_PY_FALLBACK_DIM", "384")))
ATTENTION_MAX_TOKENS = max(8, int(os.getenv("ATTENTION_PY_MAX_TOKENS", "128")))


class AttentionAnalyzeRequest(BaseModel):
    tokens: List[str] = Field(default_factory=list, min_length=1, max_length=ATTENTION_MAX_TOKENS)


class AttentionAnalyzeResponse(BaseModel):
    matrix: List[List[float]]
    source: str
    token_count: int
    model: str


class HealthResponse(BaseModel):
    ok: bool
    backend: str
    model: str


class EmbeddingBackend:
    def __init__(self) -> None:
        self._model = None
        self._init_error: Optional[str] = None
        self._lock = Lock()

    def _ensure_model(self):
        if self._model is not None:
            return self._model

        with self._lock:
            if self._model is not None:
                return self._model

            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(ATTENTION_MODEL_NAME)
            except Exception as error:  # pragma: no cover
                self._init_error = str(error)
                self._model = None

        return self._model

    def embed(self, texts: List[str]) -> tuple[List[List[float]], str]:
        model = self._ensure_model()
        if model is None:
            return [self._fallback_embedding(text) for text in texts], "fallback-hash"

        vectors = model.encode(texts, normalize_embeddings=True)
        return [self._normalize(list(vector)) for vector in vectors], "sentence-transformers"

    @staticmethod
    def _normalize(vector: List[float]) -> List[float]:
        norm = math.sqrt(sum(value * value for value in vector))
        if norm == 0:
            return [0.0 for _ in vector]
        return [value / norm for value in vector]

    @staticmethod
    def _fallback_embedding(text: str, dim: int = ATTENTION_FALLBACK_DIM) -> List[float]:
        if not text:
            text = "[EMPTY]"

        values = [0.0] * dim
        for i in range(dim):
            digest = hashlib.sha256(f"{text}::{i}".encode("utf-8")).digest()
            number = int.from_bytes(digest[:8], "big", signed=False)
            values[i] = (number / (2**64 - 1)) * 2 - 1

        norm = math.sqrt(sum(value * value for value in values)) or 1.0
        return [value / norm for value in values]


backend = EmbeddingBackend()
app = FastAPI(title="Kronos Attention Python Service", version="0.1.0")


def cosine_similarity(left: List[float], right: List[float]) -> float:
    dim = min(len(left), len(right))
    if dim == 0:
        return 0.0

    numerator = 0.0
    norm_left = 0.0
    norm_right = 0.0

    for idx in range(dim):
        lv = left[idx]
        rv = right[idx]
        numerator += lv * rv
        norm_left += lv * lv
        norm_right += rv * rv

    denominator = math.sqrt(norm_left) * math.sqrt(norm_right)
    if denominator == 0:
        return 0.0

    return numerator / denominator


def softmax(values: List[float]) -> List[float]:
    max_value = max(values)
    exps = [math.exp(value - max_value) for value in values]
    total = sum(exps) or 1.0
    return [value / total for value in exps]


def build_causal_attention_matrix(vectors: List[List[float]]) -> List[List[float]]:
    matrix: List[List[float]] = []

    for query_index, query_vector in enumerate(vectors):
        logits: List[float] = []
        for key_index, key_vector in enumerate(vectors):
            if key_index > query_index:
                logits.append(-1e9)
                continue

            similarity = cosine_similarity(query_vector, key_vector)
            distance_bias = math.exp(-(query_index - key_index) / 6)
            logits.append(1.6 * similarity + 0.8 * distance_bias)

        weights = softmax(logits)
        row = [round(weight, 4) if key_idx <= query_index else 0.0 for key_idx, weight in enumerate(weights)]
        matrix.append(row)

    return matrix


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    vectors, source = backend.embed(["health-check"])
    _ = vectors
    return HealthResponse(ok=True, backend=source, model=ATTENTION_MODEL_NAME)


@app.post("/attention/analyze", response_model=AttentionAnalyzeResponse)
def analyze_attention(payload: AttentionAnalyzeRequest) -> AttentionAnalyzeResponse:
    safe_tokens = [token if token else "[EMPTY]" for token in payload.tokens[:ATTENTION_MAX_TOKENS]]
    vectors, source = backend.embed(safe_tokens)
    matrix = build_causal_attention_matrix(vectors)

    return AttentionAnalyzeResponse(
        matrix=matrix,
        source=source,
        token_count=len(safe_tokens),
        model=ATTENTION_MODEL_NAME,
    )
