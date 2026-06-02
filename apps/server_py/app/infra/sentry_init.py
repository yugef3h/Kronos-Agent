"""Sentry 错误追踪初始化。"""

from __future__ import annotations

import sentry_sdk
from fastapi import FastAPI
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration

from app.config import get_settings

_initialized = False


def init_sentry(app: FastAPI) -> None:
    """初始化 Sentry SDK，不配置 SENTRY_DSN 则跳过。"""
    global _initialized

    settings = get_settings()
    dsn = (settings.sentry_dsn or "").strip()
    if not dsn:
        return

    sentry_sdk.init(
        dsn=dsn,
        integrations=[
            FastApiIntegration(),
            AsyncioIntegration(),
        ],
        traces_sample_rate=1.0,
        environment=(settings.node_env or "development"),
        send_default_pii=False,
    )

    _initialized = True
