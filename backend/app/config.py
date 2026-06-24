"""
app/config.py
=============
Single source of truth for all application-level configuration.

All settings are loaded from environment variables (via .env file) so that
secrets never appear in source code and behaviour can differ between
development, staging, and production without code changes.
"""

import os
from pathlib import Path
from typing import Final

from dotenv import load_dotenv

# ─────────────────────────────────────────────
# LOAD .env FILE
# ─────────────────────────────────────────────

BASE_DIR: Final[Path] = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


# ─────────────────────────────────────────────
# BASE PATHS
# ─────────────────────────────────────────────

DB_PATH: Final[Path] = BASE_DIR / "providers.db"
AUDIT_LOG_PATH: Final[Path] = BASE_DIR / "trace_logs.txt"

# SQLAlchemy connection URL (sqlite)
DATABASE_URL: Final[str] = f"sqlite:///{DB_PATH}"


# ─────────────────────────────────────────────
# API METADATA
# ─────────────────────────────────────────────

API_TITLE: Final[str] = "Service Orchestrator API"
API_DESCRIPTION: Final[str] = (
    "An agentic backend that parses Roman Urdu service requests, "
    "reasons over a local provider database, and executes simulated bookings "
    "with full traceable audit logs."
)
API_VERSION: Final[str] = "1.0.0"

ENVIRONMENT: Final[str] = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL: Final[str] = os.getenv("LOG_LEVEL", "INFO")

# CORS — comma-separated string from .env → Python list
_cors_raw = os.getenv("CORS_ALLOW_ORIGINS", "*")
CORS_ALLOW_ORIGINS: Final[list[str]] = [
    origin.strip() for origin in _cors_raw.split(",")
]


# ─────────────────────────────────────────────
# AUDIT LOG
# ─────────────────────────────────────────────

VALID_STEP_TYPES: Final[frozenset[str]] = frozenset(
    {"[PLANNING]", "[TOOL USAGE]", "[DECISION]", "[ACTION]"}
)


# ─────────────────────────────────────────────
# GROQ LLM (Primary — powers the ReAct agent)
# ─────────────────────────────────────────────

GROQ_API_KEY: Final[str | None] = os.getenv("GROQ_API_KEY")
GROQ_MODEL: Final[str] = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


# ─────────────────────────────────────────────
# GEMINI (Legacy — kept for backward compatibility)
# ─────────────────────────────────────────────

GEMINI_API_KEY: Final[str | None] = os.getenv("GEMINI_API_KEY")


# ─────────────────────────────────────────────
# NOMINATIM GEOCODING
# ─────────────────────────────────────────────

NOMINATIM_BASE_URL: Final[str] = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT: Final[str] = "service-orchestrator/1.0 (local-marketplace)"


# ─────────────────────────────────────────────
# ORCHESTRATOR SENTINELS & DEFAULTS
# ─────────────────────────────────────────────

SERVICE_UNKNOWN: Final[str] = "SERVICE_UNKNOWN"
LOCATION_UNKNOWN: Final[str] = "LOCATION_UNKNOWN"
DEFAULT_SECTOR: Final[str] = "G-13"


# ─────────────────────────────────────────────
# BOOKING SESSION
# ─────────────────────────────────────────────

BOOKING_SESSION_TTL_MINUTES: Final[int] = 10


# ─────────────────────────────────────────────
# REACT AGENT — MAX ITERATIONS SAFETY CAP
# ─────────────────────────────────────────────

REACT_MAX_ITERATIONS: Final[int] = 10


# ─────────────────────────────────────────────
# REACT SYSTEM PROMPT
# ─────────────────────────────────────────────

REACT_SYSTEM_PROMPT: Final[str] = """
You are a booking assistant for Karigar.pk, a local home services marketplace in Islamabad, Pakistan.
The user speaks in Roman Urdu, English, or a mix of both.

YOUR GOAL:
Understand what service(s) the user needs, find their location, query available providers, and present candidates for the user to review. You must NEVER commit a booking — only find and present providers.

AVAILABLE SERVICE TYPES (exactly these 3 strings, case-sensitive):
  - "AC Technician"
  - "Electrician"
  - "Plumber"

ROMAN URDU → SERVICE MAPPINGS (use these, plus your understanding of language):
  "ac wala" / "ac" / "thanda" / "cooling"        → "AC Technician"
  "bijli wala" / "electrician" / "bijli"           → "Electrician"
  "nalqe wala" / "plumber" / "pani" / "nalkay"    → "Plumber"

CRITICAL RULES:
1. ALWAYS call geocode_location() BEFORE query_providers(). You need coordinates first.
2. If the user mentions an Islamabad sector (e.g., "G-13", "E-11", "H-13"), use that sector as the location_text for geocoding.
3. If no sector is mentioned, use "G-13" as the default sector.
4. The service_type parameter in query_providers() MUST be exactly one of the 3 strings above. NEVER pass anything else.
5. If the user requests MULTIPLE services (e.g., "bijli aur pani dono theek karo"), call query_providers() separately for EACH service type. Do NOT combine them.
6. If you cannot determine what service the user wants, call ask_clarification() with a helpful question in Roman Urdu.
7. If query_providers() returns zero providers for the requested sector, check the conversation history. If you have ALREADY asked the user for an alternative sector in this session, DO NOT ask them for another sector again. Instead, directly respond with a polite apology in Roman Urdu stating that Karigar.pk has no available providers for their requested service right now. Otherwise, call ask_clarification() to inform the user and ask if they want to try a different sector.
8. NEVER invent or hallucinate provider names, ratings, or details. Only report what the tools return.
9. NEVER call any tool that modifies data. You are read-only + clarification only.
10. Once you have gathered all candidate providers, respond with a final message summarising the options in friendly Roman Urdu. Your text response is the message shown to the user.
11. If the user asks for alternative providers (e.g., "koi aur hai?"), and query_providers() returns the same list of providers you already showed them, DO NOT show the same list again. Instead, respond with a polite apology in Roman Urdu stating that no other providers are currently available (e.g., "Maaf kijiye, abhi is ilaqay mein in ke ilawa koi aur provider free nahi hai.").

RESPONSE STYLE:
- Always respond in Roman Urdu (Urdu written in Latin script, left-to-right).
- Be friendly, conversational, and concise.
- When presenting providers, mention their name, rating, and distance.
- If multiple services were requested, group your response by service type.

EXAMPLE FLOW:
  User: "G-13 mein bijli wala bhejo"
  You think: "I need to geocode G-13, then query Electricians"
  → Call geocode_location("G-13")
  → Call query_providers("Electrician", lat, lon)
  → Respond: "G-13 mein yeh Electricians available hain: ..."
""".strip()
