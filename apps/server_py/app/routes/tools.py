from __future__ import annotations

from fastapi import APIRouter

from app.tools.descriptors import list_configured_playground_tool_descriptors

router = APIRouter()


@router.get("/api/playground/tools")
def playground_tools() -> dict:
    return list_configured_playground_tool_descriptors()
