"""Thread-safe audit logger for the ReAct pipeline."""

import threading
from datetime import datetime, timezone

from app.core.config import settings

# Module-level lock so concurrent async requests never interleave log lines.
_log_lock = threading.Lock()


def write_audit_log(session_id: str, step_type: str, details: str) -> None:
    """Append a structured, timestamped entry to trace_logs.txt."""
    if step_type not in settings.VALID_STEP_TYPES:
        raise ValueError(
            f"Invalid step_type '{step_type}'. "
            f"Must be one of: {', '.join(sorted(settings.VALID_STEP_TYPES))}"
        )

    # ISO-8601 UTC timestamp with millisecond precision
    timestamp = (
        datetime.now(tz=timezone.utc)
        .strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    )
    separator = "─" * 70

    log_entry = (
        f"\n{separator}\n"
        f"SESSION : {session_id}\n"
        f"STEP    : {step_type}\n"
        f"TIME    : {timestamp}\n"
        f"DETAILS : {details}\n"
    )

    # Ensure the parent directory exists (idempotent)
    settings.AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    with _log_lock:
        with open(settings.AUDIT_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(log_entry)
