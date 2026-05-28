class SessionConflictError(Exception):
    def __init__(self, session_id: str, expected_version: int, actual_version: int) -> None:
        self.session_id = session_id
        self.expected_version = expected_version
        self.actual_version = actual_version
        super().__init__(
            f"Session {session_id} version conflict: expected {expected_version}, actual {actual_version}"
        )


class SessionStreamLockBusyError(Exception):
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        super().__init__(f"Session {session_id} is locked by another stream")
