from __future__ import annotations

from app.config import get_settings
from app.services.chat_model import get_chat_model


def resolve_gateway_chat_model():
    settings = get_settings()
    _ = settings.doubao_model
    return get_chat_model()
