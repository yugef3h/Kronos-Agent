from __future__ import annotations

import logging
from typing import Optional

from app.config import get_settings
from app.services.chat_model import get_chat_model

logger = logging.getLogger(__name__)

# Model priority tiers — higher tier = preferred
MODEL_TIERS: dict[str, int] = {
    "doubao-pro-256k": 3,
    "doubao-pro-128k": 2,
    "doubao-lite-128k": 1,
    "doubao-lite-32k": 0,
}


def resolve_gateway_chat_model(
    *,
    intent: Optional[str] = None,
    force_model: Optional[str] = None,
):
    """Resolve the chat model based on intent routing, priority, and fallback.

    Args:
        intent: Optional intent hint for model selection (e.g., 'chat', 'rag', 'code').
        force_model: Override to use a specific model name.
    """
    settings = get_settings()

    if force_model:
        logger.info("Gateway: force model=%s", force_model)
        return get_chat_model(model_name=force_model)

    model_name = settings.doubao_model
    fallback_chain = _resolve_fallback_chain(settings)

    logger.info(
        "Gateway: resolved model=%s intent=%s fallback_chain=%s",
        model_name, intent or "default", fallback_chain,
    )
    return get_chat_model(model_name=model_name)


def _resolve_fallback_chain(settings) -> list[str]:
    """Build a fallback chain of model names from env config."""
    raw = getattr(settings, 'doubao_fallback_models', None)
    if isinstance(raw, str) and raw.strip():
        return [m.strip() for m in raw.split(",") if m.strip()]
    return []


def resolve_model_by_intent(intent: str) -> str:
    """Map an intent label to a preferred model name."""
    settings = get_settings()
    intent_map = {
        "chat": settings.doubao_model,
        "rag": getattr(settings, 'doubao_embedding_model', None) or settings.doubao_model,
        "code": settings.doubao_model,
        "vision": settings.doubao_model,
    }
    return intent_map.get(intent, settings.doubao_model)


def resolve_model_by_tier(min_tier: int = 0) -> str:
    """Select the highest-tier available model above min_tier."""
    settings = get_settings()
    primary = settings.doubao_model
    primary_tier = MODEL_TIERS.get(primary, 1)
    if primary_tier >= min_tier:
        return primary

    # Search fallback chain for a model meeting tier requirement
    for model in _resolve_fallback_chain(settings):
        if MODEL_TIERS.get(model, 0) >= min_tier:
            return model
    return primary


def get_gateway_health() -> dict:
    """Return gateway health status including model availability."""
    settings = get_settings()
    return {
        "primary_model": settings.doubao_model,
        "fallback_chain": _resolve_fallback_chain(settings),
        "langgraph_enabled": settings.langgraph_enabled,
        "ready": bool(settings.doubao_api_key),
    }
