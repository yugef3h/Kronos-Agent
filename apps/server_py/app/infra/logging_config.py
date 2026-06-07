"""Structured JSON logging configuration for server_py."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Optional


class JsonFormatter(logging.Formatter):
    """JSON log formatter for structured logging output."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%S.%fZ"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }

        if record.exc_info and record.exc_info[1]:
            payload["exc"] = str(record.exc_info[1])

        extra = getattr(record, "_structured", None)
        if isinstance(extra, dict):
            payload.update(extra)

        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_structured_logging(
    *,
    level: Optional[str] = None,
    json_output: bool = True,
) -> None:
    """Configure the root logger for structured JSON output.

    Args:
        level: Log level (default from LOG_LEVEL env or INFO).
        json_output: If True, use JSON format; if False, use plain text.
    """
    log_level = level or os.getenv("LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler()

    if json_output:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        ))

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))
    # Remove existing handlers to avoid duplicates
    root_logger.handlers = [handler]

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


class RequestLogger:
    """Lightweight request-scoped structured log helper."""

    def __init__(self, request_id: str = "", session_id: str = ""):
        self.request_id = request_id
        self.session_id = session_id
        self._start = time.time()

    def log(self, logger: logging.Logger, level: int, msg: str, **extra) -> None:
        record = logging.LogRecord(
            name=logger.name,
            level=level,
            pathname="",
            lineno=0,
            msg=msg,
            args=(),
            exc_info=None,
        )
        record._structured = {  # type: ignore[attr-defined]
            "req_id": self.request_id,
            "session_id": self.session_id,
            "elapsed_ms": round((time.time() - self._start) * 1000),
            **extra,
        }
        logger.handle(record)
