"""
app/services/tools.py
=====================
LangChain-compatible tool definitions for the ReAct agent.

Each function decorated with @tool becomes a callable tool that the LLM
can invoke during the reasoning loop. These wrap the existing database and
geocoding logic — no business logic is duplicated.

IMPORTANT:
    commit_booking() is intentionally NOT a tool. The agent is read-only;
    bookings are only committed in Phase 2 (confirm-booking route), called
    directly by Python after the user approves providers.
"""

import httpx
from langchain_core.tools import tool

from app.config import (
    NOMINATIM_BASE_URL,
    NOMINATIM_USER_AGENT,
)
from app.core.logger import write_audit_log
from app.services.database import (
    get_cached_location,
    query_active_providers,
    query_all_active_providers,
    query_busy_providers,
    save_location_cache,
    get_db_session,
)
from app.models import Provider


# ─────────────────────────────────────────────
# Session ID injected at call-time by the loop
# ─────────────────────────────────────────────

_current_session_id: str = "unknown"


def set_session_id(session_id: str) -> None:
    """Set the session ID for audit logging within tools."""
    global _current_session_id
    _current_session_id = session_id


# ─────────────────────────────────────────────
# TOOL 1: GEOCODE LOCATION
# ─────────────────────────────────────────────

@tool
def geocode_location(location_text: str) -> dict:
    """
    Resolve an Islamabad sector or location name to GPS coordinates.
    Always call this BEFORE query_providers — you need lat/lon first.

    Args:
        location_text: An Islamabad sector code like "G-13", "E-11", "H-13",
                       or a location description like "Blue Area".

    Returns:
        {"lat": float, "lon": float} on success.
        {"error": "not_found", "message": str} if location cannot be resolved.
    """
    session_id = _current_session_id

    # Append "Islamabad" to improve Nominatim accuracy for sector codes
    search_query = f"{location_text}, Islamabad, Pakistan"

    # ── Check cache first ─────────────────────────────────────────
    cached = get_cached_location(search_query)
    if cached:
        write_audit_log(
            session_id,
            "[TOOL USAGE]",
            (
                f"TOOL CALLED -> geocode_location('{location_text}'). "
                f"CACHE HIT: lat={cached[0]}, lon={cached[1]}. "
                "Skipping Nominatim API call."
            ),
        )
        return {"lat": cached[0], "lon": cached[1]}

    # ── Call Nominatim API ────────────────────────────────────────
    write_audit_log(
        session_id,
        "[TOOL USAGE]",
        f"TOOL CALLED -> geocode_location('{location_text}'). Cache miss. Calling Nominatim API...",
    )

    try:
        with httpx.Client() as client:
            response = client.get(
                NOMINATIM_BASE_URL,
                params={
                    "q": search_query,
                    "format": "json",
                    "limit": 1,
                },
                headers={"User-Agent": NOMINATIM_USER_AGENT},
                timeout=10.0,
            )
            response.raise_for_status()
            results = response.json()
    except (httpx.HTTPError, Exception) as e:
        write_audit_log(
            session_id,
            "[TOOL USAGE]",
            f"Nominatim API error: {type(e).__name__}: {e}. Returning error.",
        )
        return {"error": "not_found", "message": f"Geocoding failed: {type(e).__name__}"}

    if not results:
        write_audit_log(
            session_id,
            "[TOOL USAGE]",
            f"Nominatim returned 0 results for '{search_query}'. Location not found.",
        )
        return {"error": "not_found", "message": f"Location '{location_text}' not found."}

    lat = float(results[0]["lat"])
    lon = float(results[0]["lon"])

    # ── Save to cache ─────────────────────────────────────────────
    save_location_cache(search_query, lat, lon)

    write_audit_log(
        session_id,
        "[TOOL USAGE]",
        (
            f"Nominatim resolved '{location_text}' -> lat={lat}, lon={lon}. "
            "Saved to LocationCache for future lookups."
        ),
    )

    return {"lat": lat, "lon": lon}


# ─────────────────────────────────────────────
# TOOL 2: QUERY PROVIDERS
# ─────────────────────────────────────────────

@tool
def query_providers(service_type: str, lat: float, lon: float) -> dict:
    """
    Find active providers of the given service type near the user's GPS coordinates.
    Call geocode_location first to get lat and lon.

    Args:
        service_type: Must be exactly one of: "AC Technician", "Electrician", "Plumber".
        lat: User's latitude from geocode_location.
        lon: User's longitude from geocode_location.

    Returns:
        {"providers": [list of provider dicts with id, name, rating, distance_km, location, service_type], "count": int, "busy_count": int, "total_count": int}
    """
    session_id = _current_session_id

    # Validate service_type
    valid_types = {"AC Technician", "Electrician", "Plumber"}
    if service_type not in valid_types:
        write_audit_log(
            session_id,
            "[TOOL USAGE]",
            f"TOOL CALLED -> query_providers('{service_type}', ...). INVALID service_type. Must be one of {valid_types}.",
        )
        return {
            "providers": [],
            "count": 0,
            "error": f"Invalid service_type '{service_type}'. Must be one of: {', '.join(sorted(valid_types))}",
        }

    write_audit_log(
        session_id,
        "[TOOL USAGE]",
        (
            f"TOOL CALLED -> query_providers('{service_type}', "
            f"lat={lat}, lon={lon}). Querying SQLite for active providers."
        ),
    )

    providers = query_active_providers(service_type, lat, lon)

    with get_db_session() as session:
        total_count = (
            session.query(Provider)
            .filter(Provider.service_type == service_type)
            .count()
        )
        busy_count = (
            session.query(Provider)
            .filter(Provider.service_type == service_type, Provider.status == "Busy")
            .count()
        )

    busy_providers = []
    if len(providers) == 0 and busy_count > 0:
        busy_providers = query_busy_providers(service_type, lat, lon)

    provider_names = [f"{p['name']} ({p['distance_km']}km)" for p in providers]
    write_audit_log(
        session_id,
        "[TOOL USAGE]",
        (
            f"SQLite returned {len(providers)} active '{service_type}' provider(s). "
            f"Total {total_count}, busy {busy_count}. Results: {provider_names}."
        ),
    )

    return {
        "service_type": service_type,
        "providers": providers,
        "count": len(providers),
        "busy_count": busy_count,
        "total_count": total_count,
        "busy_providers": busy_providers,
    }


# ─────────────────────────────────────────────
# TOOL 3: ASK CLARIFICATION
# ─────────────────────────────────────────────

@tool
def ask_clarification(question: str) -> dict:
    """
    Ask the user a clarifying question when their request is unclear.
    Use this when you cannot determine the service type, sector, or when
    no providers are found and you want to suggest alternatives.

    Args:
        question: A question in Roman Urdu to ask the user. Be friendly and helpful.

    Returns:
        {"clarification_requested": true, "question": str}
    """
    session_id = _current_session_id

    write_audit_log(
        session_id,
        "[TOOL USAGE]",
        f"TOOL CALLED -> ask_clarification(). Question: '{question}'",
    )

    return {
        "clarification_requested": True,
        "question": question,
    }


# ─────────────────────────────────────────────
# TOOL 4: SEARCH NEARBY PROVIDERS (city-wide fallback)
# ─────────────────────────────────────────────

@tool
def search_nearby_providers(service_type: str, lat: float, lon: float) -> dict:
    """
    Search for ALL available providers of the given service type across the entire
    city of Islamabad, regardless of sector. Use this as a FALLBACK when
    query_providers() returns zero results for the user's requested sector.

    This lets you show the user what IS available even if nothing is in their
    specific sector. Results include distance_km from the user's location.

    Args:
        service_type: Must be exactly one of: "AC Technician", "Electrician", "Plumber".
        lat: User's latitude from geocode_location (same value you used for query_providers).
        lon: User's longitude from geocode_location (same value you used for query_providers).

    Returns:
        {"providers": [...], "count": int, "busy_count": int, "total_count": int} — all active providers of that type, sorted by distance then rating.
    """
    session_id = _current_session_id

    valid_types = {"AC Technician", "Electrician", "Plumber"}
    if service_type not in valid_types:
        return {
            "providers": [],
            "count": 0,
            "error": f"Invalid service_type '{service_type}'. Must be one of: {', '.join(sorted(valid_types))}",
        }

    write_audit_log(
        session_id,
        "[TOOL USAGE]",
        f"TOOL CALLED -> search_nearby_providers('{service_type}', "
        f"lat={lat}, lon={lon}). "
        "Searching ALL sectors in Islamabad for available providers.",
    )

    providers = query_all_active_providers(service_type, lat, lon)

    with get_db_session() as session:
        total_count = (
            session.query(Provider)
            .filter(Provider.service_type == service_type)
            .count()
        )
        busy_count = (
            session.query(Provider)
            .filter(Provider.service_type == service_type, Provider.status == "Busy")
            .count()
        )

    provider_names = [f"{p['name']} ({p['location']}, {p.get('distance_km', '?')}km)" for p in providers]
    write_audit_log(
        session_id,
        "[TOOL USAGE]",
        f"City-wide search returned {len(providers)} active '{service_type}' provider(s). "
        f"Total {total_count}, busy {busy_count}. Results: {provider_names}.",
    )

    return {
        "service_type": service_type,
        "providers": providers,
        "count": len(providers),
        "busy_count": busy_count,
        "total_count": total_count,
    }


# ─────────────────────────────────────────────
# TOOL REGISTRY (used by the LangGraph agent)
# ─────────────────────────────────────────────

BOOKING_TOOLS = [geocode_location, query_providers, search_nearby_providers, ask_clarification]
