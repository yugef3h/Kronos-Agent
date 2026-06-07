"""LLM node executor — streams content from chat model with prompt template support."""

from __future__ import annotations

import logging
import time
from typing import AsyncIterator, Optional

from app.workflow.fsm import NodeState

logger = logging.getLogger(__name__)


def _resolve_prompt(node_config: dict, upstream_output: dict) -> str:
    """Build the LLM prompt from node config and upstream context."""
    template = node_config.get("prompt", "") or node_config.get("system_prompt", "")
    user_input = upstream_output.get("input", {}).get("prompt", "") or upstream_output.get("last_response", "")
    context = upstream_output.get("knowledge_context", "")

    prompt = template
    if "{input}" in prompt:
        prompt = prompt.replace("{input}", str(user_input))
    if "{context}" in prompt:
        prompt = prompt.replace("{context}", str(context))

    if not prompt.strip():
        prompt = str(user_input) or "Generate a helpful response."

    return prompt


async def execute_llm_node(
    node_state: NodeState,
    node_config: dict,
    upstream_output: dict,
    *,
    chat_model=None,
) -> AsyncIterator[dict]:
    """Execute an LLM node — resolve prompt, stream model output."""
    node_state.transition_to("RUNNING")
    node_state.started_at = time.time()

    prompt = _resolve_prompt(node_config, upstream_output)
    model_name = node_config.get("model", "default")
    temperature = float(node_config.get("temperature", 0.7))
    max_tokens = int(node_config.get("max_tokens", 2048))

    yield {
        "type": "node_start",
        "node_id": node_state.node_id,
        "node_type": "llm",
        "stage": "plan",
        "status": "info",
        "message": f"LLM node running: model={model_name} temp={temperature}",
        "timestamp": int(time.time() * 1000),
    }

    accumulated_text = ""
    error_occurred = False

    try:
        if chat_model is not None:
            async for chunk in _stream_chat_model(chat_model, prompt, temperature, max_tokens):
                accumulated_text += chunk
                yield {
                    "type": "content",
                    "node_id": node_state.node_id,
                    "content": chunk,
                    "timestamp": int(time.time() * 1000),
                }
        else:
            # Fallback: echo the processed prompt for testing
            fallback_text = f"[LLM node output for: {prompt[:100]}...]"
            accumulated_text = fallback_text
            yield {
                "type": "content",
                "node_id": node_state.node_id,
                "content": fallback_text,
                "timestamp": int(time.time() * 1000),
            }
    except Exception as exc:
        logger.error("LLM node %s failed: %s", node_state.node_id, exc)
        node_state.error = str(exc)[:500]
        node_state.transition_to("FAILED")
        node_state.completed_at = time.time()
        error_occurred = True
        yield {
            "type": "node_end",
            "node_id": node_state.node_id,
            "node_type": "llm",
            "status": "FAILED",
            "error": node_state.error,
            "timestamp": int(time.time() * 1000),
        }

    if not error_occurred:
        node_state.output = {"response": accumulated_text, "prompt": prompt, "model": model_name}
        node_state.transition_to("SUCCESS")
        node_state.completed_at = time.time()

        yield {
            "type": "node_end",
            "node_id": node_state.node_id,
            "node_type": "llm",
            "status": "SUCCESS",
            "timestamp": int(time.time() * 1000),
            "output": node_state.output,
        }


async def _stream_chat_model(chat_model, prompt: str, temperature: float, max_tokens: int) -> AsyncIterator[str]:
    """Stream from a LangChain-compatible chat model."""
    from langchain_core.messages import HumanMessage
    try:
        messages = [HumanMessage(content=prompt)]
        async for chunk in chat_model.astream(messages, {"temperature": temperature, "max_tokens": max_tokens}):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content
    except Exception:
        raise
