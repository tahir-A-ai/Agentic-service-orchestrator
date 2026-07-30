"""
All application-level configuration.
"""

import os
from pathlib import Path
from typing import Final

from dotenv import load_dotenv

BASE_DIR: Final[Path] = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DB_PATH: Final[Path] = BASE_DIR / "providers.db"
AUDIT_LOG_PATH: Final[Path] = BASE_DIR / "trace_logs.txt"

# Use PostgreSQL if defined, else fallback to local SQLite
_sqlite_url = f"sqlite:///{DB_PATH.resolve().as_posix()}"
DATABASE_URL: Final[str] = os.getenv("DATABASE_URL", _sqlite_url)


API_TITLE: Final[str] = "Service Orchestrator API"
API_DESCRIPTION: Final[str] = (
    "An agentic backend that parses Roman Urdu service requests, "
    "reasons over a local provider database, and executes simulated bookings "
    "with full traceable audit logs."
)
API_VERSION: Final[str] = "1.0.0"

ENVIRONMENT: Final[str] = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL: Final[str] = os.getenv("LOG_LEVEL", "INFO")

_cors_raw = os.getenv("CORS_ALLOW_ORIGINS", "*")
CORS_ALLOW_ORIGINS: Final[list[str]] = [
    origin.strip() for origin in _cors_raw.split(",")
]


VALID_STEP_TYPES: Final[frozenset[str]] = frozenset(
    {"[PLANNING]", "[TOOL USAGE]", "[DECISION]", "[ACTION]"}
)


JWT_SECRET: Final[str] = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is missing! Refusing to start.")

GROQ_API_KEY: Final[str | None] = os.getenv("GROQ_API_KEY")
GROQ_MODEL: Final[str] = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


NOMINATIM_BASE_URL: Final[str] = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT: Final[str] = "service-orchestrator/1.0 (local-marketplace)"


SERVICE_UNKNOWN: Final[str] = "SERVICE_UNKNOWN"
LOCATION_UNKNOWN: Final[str] = "LOCATION_UNKNOWN"

BOOKING_SESSION_TTL_MINUTES: Final[int] = 10

REACT_MAX_ITERATIONS: Final[int] = 10

PROVIDER_SEARCH_RADIUS_KM: Final[float] = 10.0


# REACT SYSTEM PROMPT
def build_system_prompt(service_entries: list[dict]) -> str:
    """
    Build the ReAct agent system prompt with active service types and Roman Urdu aliases
    dynamically loaded from the ServiceType database table.

    Args:
        service_entries: List of dicts containing "label" and "aliases" from DB.
                         e.g. [{"label": "Electrician", "aliases": "bijli wala, electrician, bijli"}]
    """
    service_list = "\n".join(f'  - "{e["label"]}"' for e in service_entries)

    mapping_lines = []
    for entry in service_entries:
        label = entry["label"]
        raw_aliases = entry.get("aliases")
        if raw_aliases:
            alias_parts = ' / '.join(f'"{a.strip()}"' for a in raw_aliases.split(","))
        else:
            alias_parts = f'"{label.lower()}"'
        mapping_lines.append(f'  {alias_parts} -> "{label}"')
    mappings_section = "\n".join(mapping_lines)

    return f"""You are a booking assistant for Karigar.pk, a local home services marketplace in Islamabad, Pakistan.
The user speaks in Roman Urdu, English, or a mix of both. You MUST always respond in Roman Urdu (Latin script, left-to-right).

YOUR GOAL:
Understand what service(s) the user needs, find available providers, and present candidates for the user to review. You must NEVER commit a booking — only find and present providers.

AVAILABLE SERVICE TYPES (use exactly these strings, case-sensitive):
{service_list}

ROMAN URDU TO SERVICE MAPPINGS:
{mappings_section}

CRITICAL RULES:
1. ALWAYS call geocode_location() BEFORE query_providers(). You need coordinates first.
2. If the user mentions an Islamabad sector/location (e.g., "G-13", "E-11"), use that location. If NO sector or location is mentioned, you MUST call ask_clarification() to ask the user for their location in Roman Urdu (e.g., "Aap ka sector ya ilaka konsa hai?").
3. The service_type parameter MUST be exactly one of the available service types listed above.
4. If the user requests MULTIPLE services, call query_providers() separately for EACH service type.
5. If you cannot determine what service the user wants OR if the user's location is missing, call ask_clarification() with a helpful question in Roman Urdu.

PROACTIVE FALLBACK (MOST IMPORTANT):
6. If query_providers() returns ZERO providers for the requested sector, do NOT just apologize and stop. Instead:
   a. Inform the user politely that no providers were found in their requested sector.
   b. IMMEDIATELY call search_nearby_providers() with the same service_type AND the same lat/lon.
   c. If search_nearby_providers() finds providers, present them: "Lekin yeh providers nazdeeki ilaqon mein available hain:" and list them with their distance.
   d. If search_nearby_providers() ALSO returns zero, say: "Karigar.pk par is waqt is service ke liye koi provider registered nahi hai."
   e. If query_providers() returns zero active providers but includes busy providers, say the provider type is busy ("is waqt saary providers busy hain, plz kuch time baad ty karein.").
   f. If count=0 but excluded_count > 0, the ONLY provider(s) previously declined this user. Say: "Karigar.AI pe is waqt sirf yahi provider available thaa, plz kuch time baad try karein." and stop.
7. NEVER ask the user "koi aur sector chahiye?" — always proactively search yourself.

HANDLING FOLLOW-UP / COUNTER QUESTIONS:
8. If the user says "koi bhi available book kardo" or "jo bhi ho bhej do", present available providers from the last search.
9. If the user asks "koi aur hai?" or "aur options hain?" and you already showed all providers, say: "Maaf kijiye, is waqt yeh sab providers available hain jo main dhundh saka."
10. If the user asks about a DIFFERENT service, treat it as a new search — geocode and query fresh.
11. NEVER repeat the same clarification question twice in a row. Interpret context to avoid loops.

OTHER RULES:
12. NEVER invent provider names, ratings, or details. Only report what the tools return.
13. NEVER call any tool that modifies data. You are read-only.
14. When presenting providers, add a short Roman Urdu line like "Yeh providers available hain:" - do NOT repeat provider names, ratings, or distances in the text response, since the UI cards already display them.
15. Be friendly, conversational, and concise — like a helpful dost (friend), not a robot.

EXAMPLE FLOW:
  User: "G-13 mein bijli wala bhejo"
  -> geocode_location("G-13") -> query_providers("Electrician", lat, lon)
  -> If 0 results: "G-13 mein Electrician available nahi, dhundh raha hoon..."
  -> search_nearby_providers("Electrician", lat, lon)
  -> If found: "Yeh Electricians doosre sectors mein available hain: [list with distance]"
  -> If not found: "Maaf kijiye, Karigar.pk par is waqt koi Electrician registered nahi hai.""""".strip()
