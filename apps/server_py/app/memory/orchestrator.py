from __future__ import annotations

import time
from typing import List

from app.domain.session_store import Message
from app.memory.constants import (
    CONTEXT_WINDOW_TOKENS,
    INPUT_BUDGET_RATIO,
    MAX_SUMMARY_CHARS,
    RECENT_MESSAGES_TO_KEEP,
    RESERVED_OUTPUT_TOKENS,
    SUMMARY_TRIGGER_MESSAGE_COUNT,
)
from app.memory.token_estimate import estimate_text_tokens
from app.memory.types import MemoryDiagnostics, MemoryPlan, SessionMemoryState


def _trim_to_max_chars(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    head_len = int(max_chars * 0.35)
    head = text[:head_len]
    tail = text[-(max_chars - len(head) - 5) :]
    return f"{head}\n...\n{tail}"


def _format_message_line(message: Message, index: int) -> str:
    speaker = "用户" if message.role == "user" else "助手"
    compact = " ".join(message.content.split())
    return f"{index + 1}. {speaker}: {compact}"


def _normalize_stored_summary(summary: str) -> str:
    text = summary.strip()
    legacy_prefix = "已有摘要:"
    while text.startswith(legacy_prefix):
        text = text[len(legacy_prefix) :].lstrip()
    return text


def _build_merged_summary(existing_summary: str, history_to_summarize: List[Message]) -> str:
    lines = [_format_message_line(message, index) for index, message in enumerate(history_to_summarize)]
    recent_digest = _trim_to_max_chars("\n".join(lines), 900)
    prior = _normalize_stored_summary(existing_summary)
    merged = (
        f"{prior}\n\n新增对话摘要:\n{recent_digest}"
        if prior
        else f"对话摘要:\n{recent_digest}"
    )
    return _trim_to_max_chars(merged, MAX_SUMMARY_CHARS)


def create_memory_plan(
    prompt: str,
    messages: List[Message],
    memory_state: SessionMemoryState,
) -> MemoryPlan:
    summary = memory_state.summary or ""
    summary_updated_at = memory_state.summaryUpdatedAt
    summary_updated = False
    summary_archive_message_count = memory_state.summaryArchiveMessageCount

    if len(messages) >= SUMMARY_TRIGGER_MESSAGE_COUNT:
        archive_upto = max(0, len(messages) - RECENT_MESSAGES_TO_KEEP)
        merge_from = min(summary_archive_message_count, archive_upto)
        if archive_upto > merge_from:
            summary_source = messages[merge_from:archive_upto]
            if summary_source:
                summary = _build_merged_summary(summary, summary_source)
                summary_updated_at = int(time.time() * 1000)
                summary_updated = True
                summary_archive_message_count = archive_upto

    prompt_tokens = estimate_text_tokens(prompt)
    summary_tokens = estimate_text_tokens(summary)
    budget_tokens = int(CONTEXT_WINDOW_TOKENS * INPUT_BUDGET_RATIO) - RESERVED_OUTPUT_TOKENS
    max_history_budget = max(0, budget_tokens - prompt_tokens - summary_tokens)

    recent_history = messages[-RECENT_MESSAGES_TO_KEEP :]
    selected_history: List[Message] = []
    selected_history_tokens = 0

    for message in reversed(recent_history):
        next_tokens = estimate_text_tokens(message.content) + 4
        if selected_history_tokens + next_tokens > max_history_budget:
            break
        selected_history.insert(0, message)
        selected_history_tokens += next_tokens

    total_input_tokens = prompt_tokens + summary_tokens + selected_history_tokens

    return MemoryPlan(
        history=selected_history,
        memorySummary=summary,
        summaryUpdated=summary_updated,
        summaryArchiveMessageCount=summary_archive_message_count,
        diagnostics=MemoryDiagnostics(
            totalInputTokensEstimate=total_input_tokens,
            budgetTokensEstimate=budget_tokens,
            historyTokensEstimate=selected_history_tokens,
            summaryTokensEstimate=summary_tokens,
            promptTokensEstimate=prompt_tokens,
        ),
    )
