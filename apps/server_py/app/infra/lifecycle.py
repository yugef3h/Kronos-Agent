"""Application lifecycle management — startup and graceful shutdown."""

from __future__ import annotations

import asyncio
import logging
import signal
from typing import Callable

logger = logging.getLogger(__name__)

_shutdown_hooks: list[Callable[[], None]] = []
_cleanup_tasks: list[Callable[[], None]] = []


def register_shutdown_hook(hook: Callable[[], None]) -> None:
    """Register a synchronous shutdown hook to run on SIGTERM/SIGINT."""
    _shutdown_hooks.append(hook)


def register_cleanup_task(task: Callable[[], None]) -> None:
    """Register a cleanup task to run during graceful shutdown."""
    _cleanup_tasks.append(task)


def _run_shutdown() -> None:
    """Execute all shutdown hooks and cleanup tasks."""
    logger.info("Starting graceful shutdown...")

    for hook in _shutdown_hooks:
        try:
            hook()
            logger.debug("Shutdown hook completed: %s", hook.__name__)
        except Exception as exc:
            logger.warning("Shutdown hook failed: %s", exc)

    for task in _cleanup_tasks:
        try:
            task()
            logger.debug("Cleanup task completed: %s", task.__name__)
        except Exception as exc:
            logger.warning("Cleanup task failed: %s", exc)

    logger.info("Graceful shutdown complete.")


def install_signal_handlers() -> None:
    """Install OS signal handlers for graceful shutdown."""
    loop = asyncio.get_event_loop()

    def handle_signal() -> None:
        logger.info("Received shutdown signal")
        _run_shutdown()
        loop.stop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, handle_signal)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler
            signal.signal(sig, lambda s, f: handle_signal())


# Register built-in cleanup
def _cleanup_token_budgets() -> None:
    from app.ai.token_budget import cleanup_stale_budgets
    count = cleanup_stale_budgets()
    if count:
        logger.info("Cleaned up %d stale token budgets", count)


def _cleanup_embedding_cache() -> None:
    from app.rag.embedding_cache import clear_embedding_cache
    # Note: we don't clear the cache on shutdown by default,
    # just log stats
    from app.rag.embedding_cache import embedding_cache_stats
    stats = embedding_cache_stats()
    logger.info("Embedding cache stats at shutdown: %s", stats)


register_cleanup_task(_cleanup_token_budgets)
register_cleanup_task(_cleanup_embedding_cache)
