from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_PY_ROOT = Path(__file__).resolve().parent.parent
APPS_ROOT = SERVER_PY_ROOT.parent
SHARED_ENV_FILE = APPS_ROOT / ".env"
LEGACY_ENV_FILE = APPS_ROOT / "server" / ".env"


def resolve_env_file() -> Optional[Path]:
    """Node / Python 共用：优先 apps/.env，兼容旧版 apps/server/.env。"""
    if SHARED_ENV_FILE.exists():
        return SHARED_ENV_FILE
    if LEGACY_ENV_FILE.exists():
        return LEGACY_ENV_FILE
    return None

LOCAL_DEV_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)

_resolved_env_file = resolve_env_file()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_resolved_env_file) if _resolved_env_file else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    port: int = Field(default=3001, alias="PORT")
    jwt_secret: str = Field(min_length=16, alias="JWT_SECRET")
    doubao_api_key: str = Field(alias="DOUBAO_API_KEY")
    doubao_base_url: str = Field(alias="DOUBAO_BASE_URL")
    doubao_model: str = Field(alias="DOUBAO_MODEL")
    doubao_embedding_model: Optional[str] = Field(default=None, alias="DOUBAO_EMBEDDING_MODEL")
    doubao_plan_timeout_ms: int = Field(default=8000, alias="DOUBAO_PLAN_TIMEOUT_MS")
    doubao_first_token_warn_ms: int = Field(default=3000, alias="DOUBAO_FIRST_TOKEN_WARN_MS")
    allowed_origin: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        alias="ALLOWED_ORIGIN",
    )
    langgraph_enabled: bool = Field(default=True, alias="LANGGRAPH_ENABLED")
    langgraph_max_tool_steps: int = Field(default=8, alias="LANGGRAPH_MAX_TOOL_STEPS")
    tavily_api_key: Optional[str] = Field(default=None, alias="TAVILY_API_KEY")
    attention_py_enabled: bool = Field(default=False, alias="ATTENTION_PY_ENABLED")
    attention_py_base_url: str = Field(
        default="http://127.0.0.1:8008",
        alias="ATTENTION_PY_BASE_URL",
    )
    attention_py_timeout_ms: int = Field(default=1200, alias="ATTENTION_PY_TIMEOUT_MS")
    rag_engine_mode: Optional[str] = Field(default=None, alias="RAG_ENGINE_MODE")
    knowledge_datasets_dir: Optional[str] = Field(default=None, alias="KNOWLEDGE_DATASETS_DIR")
    rag_routes_enabled: bool = Field(default=False, alias="RAG_ROUTES_ENABLED")
    node_env: Optional[str] = Field(default=None, alias="NODE_ENV")
    kronos_server_runtime: Literal["node", "py"] = Field(
        default="node",
        alias="KRONOS_SERVER_RUNTIME",
    )
    session_store: Literal["file", "redis"] = Field(default="file", alias="SESSION_STORE")
    redis_url: Optional[str] = Field(default=None, alias="REDIS_URL")
    session_ttl_sec: int = Field(default=604800, alias="SESSION_TTL_SEC")
    session_file_mirror: str = Field(default="true", alias="SESSION_FILE_MIRROR")
    session_stream_lock: str = Field(default="true", alias="SESSION_STREAM_LOCK")
    session_stream_lock_ttl_sec: int = Field(default=120, alias="SESSION_STREAM_LOCK_TTL_SEC")
    sentry_dsn: Optional[str] = Field(default=None, alias="SENTRY_DSN")
    langfuse_public_key: Optional[str] = Field(default=None, alias="LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key: Optional[str] = Field(default=None, alias="LANGFUSE_SECRET_KEY")
    langfuse_base_url: Optional[str] = Field(default=None, alias="LANGFUSE_BASE_URL")

    @field_validator("session_store", mode="before")
    @classmethod
    def normalize_session_store(cls, value: object) -> str:
        raw = str(value or "file").strip().lower()
        return "redis" if raw == "redis" else "file"

    @field_validator("session_ttl_sec", mode="before")
    @classmethod
    def normalize_session_ttl(cls, value: object) -> int:
        try:
            parsed = int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return 604800
        return parsed if parsed > 0 else 604800

    @property
    def session_file_mirror_enabled(self) -> bool:
        raw = self.session_file_mirror.strip().lower()
        return raw not in ("false", "0", "no")

    @field_validator("rag_engine_mode", mode="before")
    @classmethod
    def normalize_rag_mode(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip().lower() or None

    @property
    def is_production(self) -> bool:
        return (self.node_env or "").strip().lower() == "production"

    @property
    def allowed_origins(self) -> list[str]:
        parsed = [
            origin.strip()
            for origin in self.allowed_origin.split(",")
            if origin.strip()
        ]
        return list(dict.fromkeys([*parsed, *LOCAL_DEV_ORIGINS]))


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
