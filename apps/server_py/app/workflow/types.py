from __future__ import annotations

from typing import Literal

WorkflowRunStatus = Literal["PENDING", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"]
NodeRunStatus = Literal["PENDING", "RUNNING", "SUCCESS", "FAILED", "SKIPPED"]
