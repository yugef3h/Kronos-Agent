from __future__ import annotations

from app.rag.query_types import KnowledgeMetadataCondition


def matches_metadata_filter(
    metadata: dict[str, str],
    conditions: list[KnowledgeMetadataCondition],
) -> bool:
    if not conditions:
        return True

    for condition in conditions:
        field = condition.get("field", "")
        operator = condition.get("operator", "contains")
        value = condition.get("value", "")
        actual = metadata.get(field, "")

        if operator == "equals" and actual != value:
            return False
        if operator == "not_equals" and actual == value:
            return False
        if operator == "contains" and value not in actual:
            return False

    return True
