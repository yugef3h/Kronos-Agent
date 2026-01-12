from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from app.domain.session_store import Message


@dataclass
class SessionMemoryState:
    summary: str = ""
    summaryUpdatedAt: Optional[int] = None
    summaryArchiveMessageCount: int = 0


@dataclass
class MemoryDiagnostics:
    totalInputTokensEstimate: int
    budgetTokensEstimate: int
    historyTokensEstimate: int
    summaryTokensEstimate: int
    promptTokensEstimate: int


@dataclass
class MemoryPlan:
    history: List[Message]
    memorySummary: str
    summaryUpdated: bool
    summaryArchiveMessageCount: int
    diagnostics: MemoryDiagnostics
