from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

settings = get_settings()

app = FastAPI(title="kronos-server-py", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
