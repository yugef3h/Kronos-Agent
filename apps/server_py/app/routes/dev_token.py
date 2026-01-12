from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import jwt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter()


class DevTokenPayload(BaseModel):
    token: str
    tokenType: Literal["Bearer"] = "Bearer"
    expiresIn: Literal["7d"] = "7d"


def is_dev_token_route_enabled(node_env: Optional[str]) -> bool:
    return node_env != "production"


def create_dev_token(jwt_secret: str) -> DevTokenPayload:
    token = jwt.encode(
        {
            "sub": "dev-user",
            "role": "tester",
            "exp": datetime.now(timezone.utc) + timedelta(days=7),
        },
        jwt_secret,
        algorithm="HS256",
    )
    return DevTokenPayload(token=token)


@router.get("/api/dev/token", response_model=DevTokenPayload)
def dev_token() -> DevTokenPayload:
    settings = get_settings()
    if not is_dev_token_route_enabled(settings.node_env):
        raise HTTPException(status_code=404, detail="Not found")

    return create_dev_token(settings.jwt_secret)
