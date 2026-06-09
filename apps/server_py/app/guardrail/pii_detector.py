"""PII detection for guardrail — phone numbers, ID cards, emails, IPs."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

# Chinese phone number patterns
PHONE_PATTERNS = [
    re.compile(r"1[3-9]\d{9}"),          # Standard mobile
    re.compile(r"0\d{2,3}-\d{7,8}"),     # Landline with area code
    re.compile(r"400[-\s]?\d{3}[-\s]?\d{4}"),  # 400 numbers
]

# Chinese ID card (18 digits, with checksum pattern)
ID_CARD_PATTERN = re.compile(r"[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]")

# Email pattern
EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# IP address (IPv4)
IP_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")

# Credit card pattern (simplified Luhn-pattern prefixes)
CREDIT_CARD_PATTERN = re.compile(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})\b")


@dataclass
class PIIHit:
    type: str  # 'phone', 'id_card', 'email', 'ip', 'credit_card'
    value: str
    position: int


@dataclass
class PIIResult:
    has_pii: bool = False
    hits: list[PIIHit] = field(default_factory=list)
    summary: dict = field(default_factory=dict)


def detect_pii(
    text: str,
    *,
    check_phone: bool = True,
    check_id_card: bool = True,
    check_email: bool = True,
    check_ip: bool = True,
    check_credit_card: bool = False,
) -> PIIResult:
    """Detect PII in the given text using regex patterns.

    Args:
        text: The text to scan for PII.
        check_*: Toggle specific PII detectors.

    Returns:
        PIIResult with has_pii flag, hit details, and summary counts.
    """
    hits: list[PIIHit] = []

    if check_phone:
        for pattern in PHONE_PATTERNS:
            for match in pattern.finditer(text):
                hits.append(PIIHit(type="phone", value=match.group(), position=match.start()))

    if check_id_card and ID_CARD_PATTERN:
        for match in ID_CARD_PATTERN.finditer(text):
            hits.append(PIIHit(type="id_card", value=match.group()[:6] + "****", position=match.start()))

    if check_email:
        for match in EMAIL_PATTERN.finditer(text):
            hits.append(PIIHit(type="email", value=match.group(), position=match.start()))

    if check_ip:
        for match in IP_PATTERN.finditer(text):
            ip_str = match.group()
            parts = ip_str.split(".")
            try:
                if all(0 <= int(p) <= 255 for p in parts):
                    hits.append(PIIHit(type="ip", value=ip_str, position=match.start()))
            except ValueError:
                continue  # Skip malformed IP-like strings

    if check_credit_card:
        for match in CREDIT_CARD_PATTERN.finditer(text):
            hits.append(PIIHit(type="credit_card", value=match.group()[:4] + "****", position=match.start()))

    # Deduplicate by position
    seen_positions: set[int] = set()
    unique_hits: list[PIIHit] = []
    for hit in hits:
        if hit.position not in seen_positions:
            seen_positions.add(hit.position)
            unique_hits.append(hit)

    summary = {
        "total_hits": len(unique_hits),
        "phone_count": sum(1 for h in unique_hits if h.type == "phone"),
        "id_card_count": sum(1 for h in unique_hits if h.type == "id_card"),
        "email_count": sum(1 for h in unique_hits if h.type == "email"),
        "ip_count": sum(1 for h in unique_hits if h.type == "ip"),
        "credit_card_count": sum(1 for h in unique_hits if h.type == "credit_card"),
    }

    return PIIResult(has_pii=len(unique_hits) > 0, hits=unique_hits, summary=summary)


def mask_pii(
    text: str,
    *,
    mask_char: str = "*",
    preserve_count: int = 2,
) -> str:
    """Mask detected PII in text by replacing middle characters with mask_char."""
    result = detect_pii(text)
    if not result.has_pii:
        return text

    # Sort hits by position in reverse to replace from end
    sorted_hits = sorted(result.hits, key=lambda h: h.position, reverse=True)
    output = list(text)

    for hit in sorted_hits:
        start = hit.position
        end = start + len(hit.value)
        visible = max(0, preserve_count)
        for i in range(start, end):
            if (i - start) < visible or (end - i) <= visible:
                continue
            if i < len(output):
                output[i] = mask_char

    return "".join(output)
