from app.memory.constants import APPROX_TOKEN_PER_CHAR


def estimate_text_tokens(text: str) -> int:
    if not text.strip():
        return 0
    return max(1, int((len(text) * APPROX_TOKEN_PER_CHAR) + 0.999))
