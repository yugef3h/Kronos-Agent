SESSION_REDIS_KEY_PREFIX = "kronos:session:"


def to_session_redis_key(session_id: str) -> str:
    return f"{SESSION_REDIS_KEY_PREFIX}{session_id}"
