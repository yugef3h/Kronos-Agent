from __future__ import annotations

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


def should_skip_auth(path: str) -> bool:
    if path == "/api/dev/token":
        return True
    if ATTACHMENT_PREFIX.match(path):
        return True
    if DRAFT_PREVIEW.match(path):
        return True
    if WORKFLOW_EXAMPLES.match(path):
        return True
    return False


def verify_bearer_token(authorization: Optional[str], jwt_secret: str) -> Optional[JSONResponse]:
    if not authorization or not authorization.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"error": "Missing bearer token"})

    token = authorization[len("Bearer ") :]
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

        if should_skip_auth(path):
            return await call_next(request)

        error_response = verify_bearer_token(
            request.headers.get("authorization"),
            self._settings.jwt_secret,
        )
        if error_response is not None:
            return error_response

        return await call_next(request)
