from __future__ import annotations

from functools import lru_cache
from typing import Optional
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_ROOT = Path(__file__).resolve().parent.parent
REPO_SERVER_ENV = SERVER_ROOT.parent / "server" / ".env"

LOCAL_DEV_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_SERVER_ENV) if REPO_SERVER_ENV.exists() else None,
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
    node_env: Optional[str] = Field(default=None, alias="NODE_ENV")
    kronos_server_runtime: Literal["node", "py"] = Field(
        default="node",
        alias="KRONOS_SERVER_RUNTIME",
    )

    @field_validator("rag_engine_mode", mode="before")
    @classmethod
    def normalize_rag_mode(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip().lower() or None

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
