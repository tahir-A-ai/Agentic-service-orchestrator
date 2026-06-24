"""
app/core/logger.py
==================
Thread-safe audit logger for the ReAct pipeline.

Writes structured, human-readable entries to trace_logs.txt so that every
agent reasoning step is permanently traceable for debugging and portfolio
demonstrations.
"""

import threading
from datetime import datetime, timezone

from app.config import AUDIT_LOG_PATH, VALID_STEP_TYPES

# Module-level lock so concurrent async requests never interleave log lines.
_log_lock = threading.Lock()


def write_audit_log(session_id: str, step_type: str, details: str) -> None:
    """
    Append a structured, timestamped entry to trace_logs.txt.

    The function is intentionally synchronous and wrapped with a threading
    lock so it is safe to call from any async FastAPI route without risk of
    log-line interleaving across concurrent requests.

    Args:
        session_id : Unique identifier for this request session (UUID4).
        step_type  : Must be one of [PLANNING] | [TOOL USAGE] | [DECISION] | [ACTION].
        details    : Free-form description of the agent's internal reasoning step.

    Raises:
        ValueError: If step_type is not one of the four valid ReAct headers.
        OSError   : If the log file cannot be opened for writing.
    """
    if step_type not in VALID_STEP_TYPES:
        raise ValueError(
            f"Invalid step_type '{step_type}'. "
            f"Must be one of: {', '.join(sorted(VALID_STEP_TYPES))}"
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
    AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    with _log_lock:
        with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(log_entry)
