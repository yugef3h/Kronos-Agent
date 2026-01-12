from __future__ import annotations

import os

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.domain.session_store import init_session_store
from app.middleware.auth import JwtAuthMiddleware
from app.routes.dev_token import router as dev_token_router
from app.routes.session import router as session_router

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_session_store()
    yield


app = FastAPI(title="kronos-server-py", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(JwtAuthMiddleware, settings=settings)
app.include_router(dev_token_router)
app.include_router(session_router)


@app.get("/healthz")
def healthz() -> dict:
    return {
        "ok": True,
        "service": "kronos-server-py",
        "runtime": settings.kronos_server_runtime,
    }


def main() -> None:
    import uvicorn

    port = int(os.getenv("PORT", str(settings.port)))
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        reload=os.getenv("NODE_ENV") != "production",
    )


if __name__ == "__main__":
    main()
