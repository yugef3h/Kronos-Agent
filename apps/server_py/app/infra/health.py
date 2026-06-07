"""Component-level health check aggregator."""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

logger = logging.getLogger(__name__)

HealthCheckFn = Callable[[], dict]


_health_checks: dict[str, HealthCheckFn] = {}


def register_health_check(name: str, check_fn: HealthCheckFn) -> None:
    """Register a named health check function."""
    _health_checks[name] = check_fn


async def run_all_health_checks() -> dict:
    """Run all registered health checks and return aggregated results."""
    results: dict[str, dict] = {}
    all_healthy = True
    start = time.time()

    for name, check_fn in _health_checks.items():
        try:
            result = check_fn()
            healthy = result.get("healthy", True)
            results[name] = {"healthy": healthy, **result}
            if not healthy:
                all_healthy = False
        except Exception as exc:
            logger.warning("Health check '%s' failed: %s", name, exc)
            results[name] = {"healthy": False, "error": str(exc)}
            all_healthy = False

    elapsed_ms = round((time.time() - start) * 1000)
    return {
        "status": "ok" if all_healthy else "degraded",
        "checks": results,
        "total_checks": len(results),
        "healthy_count": sum(1 for r in results.values() if r.get("healthy", False)),
        "elapsed_ms": elapsed_ms,
    }


# Built-in checks
def _check_redis() -> dict:
    try:
        from app.infra.redis_client import get_redis_client
        client = get_redis_client()
        if client:
            client.ping()
            return {"healthy": True, "message": "redis connected"}
        return {"healthy": True, "message": "redis not configured"}
    except Exception as exc:
        return {"healthy": False, "error": str(exc)}


def _check_data_dirs() -> dict:
    from app.rag.paths import resolve_knowledge_datasets_dir, resolve_knowledge_datasets_store_path
    ds_dir = resolve_knowledge_datasets_dir()
    store = resolve_knowledge_datasets_store_path()
    return {
        "healthy": True,
        "datasets_dir_exists": ds_dir.exists(),
        "store_path_exists": store.exists(),
    }


def _check_rag_engine() -> dict:
    from app.rag.engine import resolve_rag_engine_mode
    mode = resolve_rag_engine_mode()
    return {"healthy": True, "rag_engine_mode": mode}


def _check_ai_gateway() -> dict:
    from app.ai.gateway import get_gateway_health
    return get_gateway_health()


# Register built-ins
register_health_check("redis", _check_redis)
register_health_check("data_dirs", _check_data_dirs)
register_health_check("rag_engine", _check_rag_engine)
register_health_check("ai_gateway", _check_ai_gateway)
