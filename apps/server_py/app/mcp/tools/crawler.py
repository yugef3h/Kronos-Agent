"""MCP tools: crawl_weibo and read_dataset_manifest."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from app.mcp.server import register_tool


async def _handle_crawl_weibo(arguments: dict) -> dict:
    """Trigger a weibo crawler run via subprocess."""
    uid = arguments.get("uid", "")
    pages = int(arguments.get("pages", 1))

    if not uid.strip():
        return {"error": "uid is required", "summary": "", "post_count": 0}

    crawler_dir = Path(__file__).resolve().parent.parent.parent.parent.parent / "crawler"
    crawler_script = crawler_dir / "main.py" if crawler_dir.exists() else None

    if not crawler_script or not crawler_script.exists():
        return {
            "summary": "Crawler script not found at apps/crawler/main.py",
            "post_count": 0,
            "uid": uid,
        }

    try:
        result = subprocess.run(
            ["python3", str(crawler_script), "--uid", uid, "--pages", str(pages)],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(crawler_dir),
        )
        return {
            "summary": result.stdout[:1000] or result.stderr[:1000],
            "post_count": result.stdout.count("\n"),
            "uid": uid,
            "pages": pages,
            "success": result.returncode == 0,
        }
    except subprocess.TimeoutExpired:
        return {"error": "Crawler timed out after 120s", "uid": uid}
    except Exception as exc:
        return {"error": str(exc), "uid": uid}


def register() -> None:
    register_tool(
        name="crawl_weibo",
        description="Crawl Weibo posts for a user ID and return summary statistics",
        input_schema={
            "type": "object",
            "properties": {
                "uid": {"type": "string", "description": "Weibo user ID to crawl"},
                "pages": {"type": "integer", "description": "Number of pages to crawl", "default": 1},
            },
            "required": ["uid"],
        },
        handler=_handle_crawl_weibo,
    )

    register_tool(
        name="read_dataset_manifest",
        description="List available knowledge datasets and their metadata",
        input_schema={
            "type": "object",
            "properties": {},
        },
        handler=_handle_read_manifest,
    )


async def _handle_read_manifest(_arguments: dict) -> dict:
    """Read and return the list of available datasets."""
    try:
        from app.rag.dataset_store import list_knowledge_datasets
        from app.rag.embedding_cache import embedding_cache_stats

        datasets = list_knowledge_datasets()
        cache_stats = embedding_cache_stats()

        return {
            "dataset_count": len(datasets),
            "datasets": [
                {
                    "id": ds.get("id", ""),
                    "name": ds.get("name", ""),
                    "document_count": ds.get("documentCount", 0),
                    "chunk_count": ds.get("chunkCount", 0),
                    "created_at": ds.get("createdAt", ""),
                }
                for ds in datasets
            ],
            "cache": cache_stats,
        }
    except Exception as exc:
        return {"error": str(exc), "dataset_count": 0, "datasets": []}
