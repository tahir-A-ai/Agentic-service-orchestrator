"""Thread-safe audit logger for the ReAct pipeline with automated log rotation."""

import logging
from logging.handlers import RotatingFileHandler
import threading
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings

# Module-level lock so concurrent async requests never interleave log lines.
_log_lock = threading.Lock()

_audit_logger: logging.Logger | None = None


def _get_audit_logger() -> logging.Logger:
    """Return a configured Logger with a RotatingFileHandler (max 10MB, 5 backups)."""
    global _audit_logger
    if _audit_logger is not None:
        return _audit_logger

    log_path: Path = settings.AUDIT_LOG_PATH
    log_path.parent.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("karigar.audit")
    logger.setLevel(logging.INFO)
    logger.propagate = False  # Keep separate from stdout console logs

    if not logger.handlers:
        handler = RotatingFileHandler(
            filename=str(log_path),
            maxBytes=10 * 1024 * 1024,  # 10 MB per file
            backupCount=5,               # Keep up to 5 backups (trace_logs.txt.1 .. .5)
            encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)

    _audit_logger = logger
    return _audit_logger


def write_audit_log(session_id: str, step_type: str, details: str) -> None:
    """Append a structured, timestamped entry to trace_logs.txt with automatic rotation."""
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
        f"DETAILS : {details}"
    )

    with _log_lock:
        logger = _get_audit_logger()
        logger.info(log_entry)

