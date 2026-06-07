"""Chinese sensitive word list loader and matcher."""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Default word list — extend via SENSITIVE_WORDS_FILE env var
_DEFAULT_WORDS = [
    # Profanity / abusive (examples — customize for deployment)
    "暴力", "赌博", "色情", "毒品",
]

_word_cache: Optional[list[str]] = None
_pattern_cache: Optional[list[re.Pattern[str]]] = None


def _resolve_word_list_path() -> Optional[Path]:
    """Resolve the sensitive words file path from env or use built-in."""
    raw = os.getenv("SENSITIVE_WORDS_FILE", "").strip()
    if raw:
        path = Path(raw).expanduser()
        if path.exists():
            return path
        logger.warning("SENSITIVE_WORDS_FILE not found: %s", raw)
    return None


def load_sensitive_words() -> list[str]:
    """Load sensitive word list from file or use built-in defaults."""
    global _word_cache
    if _word_cache is not None:
        return _word_cache

    file_path = _resolve_word_list_path()
    if file_path:
        try:
            words = [
                line.strip()
                for line in file_path.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.strip().startswith("#")
            ]
            _word_cache = words
            logger.info("Loaded %d sensitive words from %s", len(words), file_path)
            return _word_cache
        except OSError as exc:
            logger.warning("Failed to read sensitive words file: %s", exc)

    _word_cache = list(_DEFAULT_WORDS)
    return _word_cache


def get_sensitive_patterns() -> list[re.Pattern[str]]:
    """Compile and cache regex patterns for sensitive words."""
    global _pattern_cache
    if _pattern_cache is not None:
        return _pattern_cache

    words = load_sensitive_words()
    _pattern_cache = [
        re.compile(re.escape(word), re.IGNORECASE)
        for word in words
        if word
    ]
    return _pattern_cache


def check_sensitive_words(
    text: str,
    *,
    rule_profile: str = "dev",
) -> dict:
    """Check text against sensitive word list for a given rule profile.

    Profiles:
        strict — block on any match
        dev    — warn but don't block (for development)
        off     — no checking
    """
    if rule_profile == "off":
        return {"blocked": False, "rule_profile": "off", "hits": [], "matched_words": []}

    patterns = get_sensitive_patterns()
    hits: list[dict] = []
    matched_words: list[str] = []

    for i, pattern in enumerate(patterns):
        for match in pattern.finditer(text):
            word = load_sensitive_words()[i] if i < len(load_sensitive_words()) else pattern.pattern
            hits.append({
                "word": word,
                "position": match.start(),
                "matched_text": match.group(),
            })
            if word not in matched_words:
                matched_words.append(word)

    blocked = len(hits) > 0 and rule_profile == "strict"

    return {
        "blocked": blocked,
        "rule_profile": rule_profile,
        "hits": hits,
        "matched_words": matched_words,
        "total_hits": len(hits),
    }


def add_sensitive_word(word: str) -> None:
    """Runtime addition to the sensitive word list (non-persistent)."""
    words = load_sensitive_words()
    if word not in words:
        words.append(word)
        global _pattern_cache
        _pattern_cache = None  # invalidate cache


def reload_sensitive_words() -> int:
    """Force reload word list from file. Returns new count."""
    global _word_cache, _pattern_cache
    _word_cache = None
    _pattern_cache = None
    return len(load_sensitive_words())
