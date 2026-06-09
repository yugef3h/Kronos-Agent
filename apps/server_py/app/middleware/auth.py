from __future__ import annotations

import os
import re
from typing import Callable, Optional

import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import Settings

ATTACHMENT_PREFIX = re.compile(r"^/api/attachments/")
DRAFT_PREVIEW = re.compile(r"^/api/workflow/apps/[^/]+/draft-preview")
WORKFLOW_EXAMPLES = re.compile(r"^/api/workflow/examples")


def _is_production() -> bool:
    return (os.environ.get("NODE_ENV") or "").strip().lower() == "production"


def should_skip_auth(path: str, method: str = "GET") -> bool:
    if path == "/api/dev/token":
        return True
    if ATTACHMENT_PREFIX.match(path):
        return True
    if DRAFT_PREVIEW.match(path) and not _is_production():
        return True
    if WORKFLOW_EXAMPLES.match(path) and method.upper() == "GET":
        return True
    return False


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Extract the raw token from a Bearer authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[len("Bearer "):].strip()
    return token or None


def verify_bearer_token(authorization: Optional[str], jwt_secret: str) -> Optional[JSONResponse]:
    token = _extract_bearer_token(authorization)
    if not token:
        return JSONResponse(status_code=401, content={"error": "Missing bearer token"})
    try:
        jwt.decode(token, jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return JSONResponse(status_code=401, content={"error": "Invalid JWT token"})
    return None


class JwtAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:
        super().__init__(app)
        self._settings = settings

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if not path.startswith("/api"):
            return await call_next(request)

        if should_skip_auth(path, request.method):
            return await call_next(request)

        error_response = verify_bearer_token(
            request.headers.get("authorization"),
            self._settings.jwt_secret,
        )
        if error_response is not None:
            return error_response

        return await call_next(request)
