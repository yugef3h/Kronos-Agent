from __future__ import annotations

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/workflow/knowledge-retrieval", tags=["knowledge-retrieval"])


@router.post("/query")
async def knowledge_retrieval_query(_body: dict) -> dict:
    raise HTTPException(status_code=501, detail="RAG query route pending wave 2b migration")


@router.post("/compare")
async def knowledge_retrieval_compare(_body: dict) -> dict:
    raise HTTPException(status_code=501, detail="RAG compare route pending wave 2b migration")


@router.post("/evaluate")
async def knowledge_retrieval_evaluate(_body: dict) -> dict:
    raise HTTPException(status_code=501, detail="RAG evaluate route pending wave 2b migration")
