from functools import lru_cache
from typing import Optional

from langchain_openai import ChatOpenAI

from app.config import get_settings


@lru_cache
def get_chat_model(model_name: Optional[str] = None) -> ChatOpenAI:
    """Return a configured ChatOpenAI instance.

    Args:
        model_name: Optional override for the model name; falls back to
                    settings.doubao_model when omitted or empty.
    """
    settings = get_settings()
    model = model_name or settings.doubao_model
    if not model.strip():
        raise RuntimeError("DOUBAO_MODEL is not set")
    if not settings.doubao_api_key.strip():
        raise RuntimeError("DOUBAO_API_KEY is not set")
    return ChatOpenAI(
        model=model.strip(),
        api_key=settings.doubao_api_key,
        base_url=settings.doubao_base_url,
        temperature=0.5,
    )
