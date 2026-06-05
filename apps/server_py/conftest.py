from __future__ import annotations

import pytest


@pytest.fixture
def sample_prompt() -> str:
    return "今天有什么科技新闻？"
