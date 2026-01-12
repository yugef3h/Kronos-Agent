from functools import lru_cache

from langchain_openai import ChatOpenAI

from app.config import get_settings


@lru_cache
def get_chat_model() -> ChatOpenAI:
    settings = get_settings()
    return ChatOpenAI(
        model=settings.doubao_model,
        api_key=settings.doubao_api_key,
        base_url=settings.doubao_base_url,
        temperature=0.5,
    )
