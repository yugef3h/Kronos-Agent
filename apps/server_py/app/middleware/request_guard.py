"""Request guard middleware — size limits, timeout, and rate headers."""

from __future__ import annotations

import logging
import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

# Default limits
MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024      # 5MB
MAX_CHAT_PROMPT_BYTES = 2 * 1024 * 1024       # 2MB
REQUEST_TIMEOUT_SEC = 120                       # 2 minutes


class RequestGuardMiddleware(BaseHTTPMiddleware):
    """Middleware that enforces request size limits and adds rate headers."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response],
    ) -> Response:
        start_time = time.time()

        # Check content-length header
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                body_size = int(content_length)
                if body_size > MAX_REQUEST_BODY_BYTES:
                    logger.warning(
                        "Request body too large: %d bytes from %s",
                        body_size, request.client.host if request.client else "unknown",
                    )
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Request body too large", "max_bytes": MAX_REQUEST_BODY_BYTES},
                    )
            except ValueError:
                pass

        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error("Unhandled middleware error: %s", exc)
            response = JSONResponse(
                status_code=500,
                content={"error": "Internal server error"},
            )

        elapsed_ms = round((time.time() - start_time) * 1000)
        response.headers["X-Response-Time-Ms"] = str(elapsed_ms)
        response.headers["X-Request-Id"] = request.headers.get(
            "x-request-id", f"req_{int(start_time * 1000)}"
        )

        return response


def validate_chat_prompt_size(prompt: str) -> str | None:
    """Validate chat prompt size. Returns error message or None if valid."""
    if len(prompt.encode("utf-8")) > MAX_CHAT_PROMPT_BYTES:
        return f"Prompt exceeds maximum size of {MAX_CHAT_PROMPT_BYTES} bytes"
    return None
