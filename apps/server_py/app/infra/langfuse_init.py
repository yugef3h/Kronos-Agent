"""LangFuse LLM 链路追踪初始化。"""

from __future__ import annotations

from langchain.callbacks.base import BaseCallbackHandler
from langfuse.langchain import CallbackHandler

from app.config import get_settings


def _langfuse_configured() -> bool:
    settings = get_settings()
    return bool(
        (settings.langfuse_public_key or "").strip()
        and (settings.langfuse_secret_key or "").strip()
        and (settings.langfuse_base_url or "").strip()
    )


def create_langfuse_handler(
    session_id: str | None = None,
    user_id: str | None = None,
    tags: list[str] | None = None,
) -> BaseCallbackHandler | None:
    """创建 LangFuse 回调处理器，环境变量未配置时返回 None。

    参数:
        session_id: 关联的会话 ID，用于在 LangFuse 中按会话聚合。
        user_id: 关联的用户 ID。
        tags: 标签列表，默认 ['kronos']。

    返回:
        CallbackHandler 实例传给 LangChain callbacks，或 None（跳过追踪）。
    """
    if not _langfuse_configured():
        return None

    settings = get_settings()

    return CallbackHandler(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_base_url,
        session_id=session_id,
        user_id=user_id,
        tags=tags or ["kronos"],
    )
