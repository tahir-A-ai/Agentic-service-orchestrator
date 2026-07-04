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
# PROVIDER SEARCH RADIUS (km)
# ─────────────────────────────────────────────
# query_providers filters results within this radius.
# search_nearby_providers ignores this and returns all active providers.

PROVIDER_SEARCH_RADIUS_KM: Final[float] = 10.0


# ─────────────────────────────────────────────
# REACT SYSTEM PROMPT
# ─────────────────────────────────────────────

REACT_SYSTEM_PROMPT: Final[str] = """
You are a booking assistant for Karigar.pk, a local home services marketplace in Islamabad, Pakistan.
The user speaks in Roman Urdu, English, or a mix of both. You MUST always respond in Roman Urdu (Latin script, left-to-right).

YOUR GOAL:
Understand what service(s) the user needs, find available providers, and present candidates for the user to review. You must NEVER commit a booking — only find and present providers.

AVAILABLE SERVICE TYPES (exactly these 3 strings, case-sensitive):
  - "AC Technician"
  - "Electrician"
  - "Plumber"

ROMAN URDU → SERVICE MAPPINGS:
  "ac wala" / "ac" / "cooling"          → "AC Technician"
  "bijli wala" / "electrician" / "bijli" → "Electrician"
  "nalqe wala" / "plumber" / "pani"    → "Plumber"

CRITICAL RULES:
1. ALWAYS call geocode_location() BEFORE query_providers(). You need coordinates first.
2. If the user mentions an Islamabad sector (e.g., "G-13", "E-11"), use that sector. If no sector is mentioned, use "G-13" as default.
3. The service_type parameter MUST be exactly one of the 3 strings above.
4. If the user requests MULTIPLE services, call query_providers() separately for EACH service type.
5. If you cannot determine what service the user wants, call ask_clarification() with a helpful question in Roman Urdu.

PROACTIVE FALLBACK (MOST IMPORTANT):
6. If query_providers() returns ZERO providers for the requested sector (it only returns providers within ~10km), do NOT just apologize and stop. Instead:
   a. First, inform the user politely that no providers were found in their requested sector.
   b. Then IMMEDIATELY call search_nearby_providers() with the same service_type AND the same lat/lon to find providers in other sectors across Islamabad.
   c. If search_nearby_providers() finds providers, present them to the user with a message like "Lekin yeh providers nazdeeki ilaqon mein available hain:" and list them with their distance.
   d. If search_nearby_providers() ALSO returns zero, THEN apologize and say Karigar.pk par is waqt is service ke liye koi provider registered nahi hai.
   e. If query_providers() returns zero active providers but the tool result includes busy providers for that service, say the provider type is currently busy (e.g. "sab busy hain" or "abhi sab busy hain") instead of saying they are not registered.
7. NEVER ask the user "koi aur sector chahiye?" — always proactively search yourself using search_nearby_providers().

HANDLING FOLLOW-UP / COUNTER QUESTIONS:
8. If the user says something like "koi bhi available book kardo" or "jo bhi ho bhej do", understand they want to proceed with whatever providers are available. Present the available providers from the last search results.
9. If the user asks "koi aur hai?" or "aur options hain?", and you already showed all available providers, politely say "Maaf kijiye, is waqt yeh sab providers available hain jo main dhundh saka."
10. If the user asks about a DIFFERENT service (e.g., switches from electrician to plumber), treat it as a new search — geocode and query fresh.
11. NEVER repeat the same clarification question twice in a row. If the user's answer is unclear, try your best to interpret it using context from the conversation.

OTHER RULES:
12. NEVER invent or hallucinate provider names, ratings, or details. Only report what the tools return.
13. NEVER call any tool that modifies data. You are read-only.
14. When presenting providers, always mention their name, rating, location, and distance (distance_km).
15. Be friendly, conversational, and concise. Feel like a helpful dost (friend), not a robot.

EXAMPLE FLOW:
  User: "G-13 mein bijli wala bhejo"
  → geocode_location("G-13") → query_providers("Electrician", lat, lon)
  → If 0 results: "G-13 mein Electrician available nahi hai, lekin main nazdeeki ilaqon mein dhundh raha hoon..."
  → search_nearby_providers("Electrician", lat, lon)
  → If found: "Yeh Electricians doosre sectors mein available hain: [list them with distance]"
  → If not found: "Maaf kijiye, Karigar.pk par is waqt koi Electrician registered nahi hai."
""".strip()
