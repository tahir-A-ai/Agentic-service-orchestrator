"""Startup routines and initialization logic for the FastAPI application."""

import asyncio
from app.services.database import init_db, get_db_session
from app.models import ServiceType, LocationCache
from app.services.tools import refresh_valid_service_types
from app.core.config import settings


async def _setup_postgres_checkpointer() -> None:
    """
    Create the LangGraph checkpoint tables in PostgreSQL on first boot.

    AsyncPostgresSaver.setup() is idempotent (uses CREATE TABLE IF NOT EXISTS)
    so it is safe to call every startup. Skipped entirely on SQLite.
    """
    db_url = settings.resolved_database_url
    if not db_url.startswith("postgresql"):
        return
    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        import psycopg
        conn_str = db_url.replace("postgresql+psycopg2", "postgresql").replace("postgresql+psycopg", "postgresql")
        async with await psycopg.AsyncConnection.connect(conn_str, autocommit=True) as conn:
            checkpointer = AsyncPostgresSaver(conn)
            await checkpointer.setup()
    except Exception as exc:
        # Non-fatal: log and continue — app still starts, checkpoint may fail later
        import logging
        logging.getLogger(__name__).warning(
            "Could not initialize PostgreSQL checkpointer tables: %s", exc
        )


_INITIAL_LOCATIONS = [
    # Sectors E
    ("E-7", 33.7253, 73.0427),
    ("E-8", 33.7196, 73.0305),
    ("E-9", 33.7142, 73.0183),
    ("E-11", 33.7005, 72.9818),
    ("E-11/1", 33.7030, 72.9840),
    ("E-11/2", 33.7015, 72.9825),
    ("E-11/3", 33.6990, 72.9800),
    ("E-11/4", 33.6975, 72.9785),
    # Sectors F
    ("F-6", 33.7299, 73.0768),
    ("F-7", 33.7215, 73.0543),
    ("F-8", 33.7118, 73.0344),
    ("F-10", 33.6934, 73.0039),
    ("F-11", 33.6844, 72.9822),
    # Sectors G
    ("G-5", 33.7208, 73.0983),
    ("G-6", 33.7083, 73.0850),
    ("G-7", 33.7011, 73.0632),
    ("G-8", 33.6924, 73.0416),
    ("G-9", 33.6841, 73.0201),
    ("G-10", 33.6749, 72.9984),
    ("G-11", 33.6662, 72.9772),
    ("G-12", 33.6595, 72.9810),
    ("G-13", 33.6515, 72.9621),
    ("G-14", 33.6427, 72.9405),
    ("G-15", 33.6338, 72.9188),
    # Sectors H
    ("H-8", 33.6766, 73.0658),
    ("H-9", 33.6682, 73.0441),
    ("H-10", 33.6598, 73.0225),
    ("H-11", 33.6544, 73.0092),
    ("H-12", 33.6449, 72.9902),
    ("H-13", 33.6367, 72.9755),
    # Sectors I
    ("I-8", 33.6685, 73.0768),
    ("I-9", 33.6601, 73.0551),
    ("I-10", 33.6517, 73.0335),
    ("I-11", 33.6433, 73.0118),
    ("I-12", 33.6349, 72.9901),
    ("I-14", 33.6181, 72.9467),
    # Landmarks & Zones
    ("Blue Area", 33.7103, 73.0652),
    ("Diplomatic Enclave", 33.7225, 73.1114),
    ("Bani Gala", 33.7056, 73.1558),
    ("Chak Shahzad", 33.6667, 73.1333),
    ("Gulberg Greens", 33.5936, 73.1417),
    # DHA Islamabad / Rawalpindi
    ("DHA", 33.5283, 73.1044),
    ("DHA Phase 1", 33.5283, 73.1044),
    ("DHA Phase 2", 33.5186, 73.1481),
    ("DHA Phase 3", 33.5276, 73.1492),
    ("DHA Phase 4", 33.5350, 73.1150),
    ("DHA Phase 5", 33.5301, 73.1736),
    ("DHA Phase 6", 33.5050, 73.2000),
    # Bahria Town
    ("Bahria Town", 33.5300, 73.1000),
    ("Bahria Town Phase 1", 33.5412, 73.1114),
    ("Bahria Town Phase 2", 33.5385, 73.1089),
    ("Bahria Town Phase 3", 33.5350, 73.1050),
    ("Bahria Town Phase 4", 33.5300, 73.1000),
    ("Bahria Town Phase 5", 33.5250, 73.0950),
    ("Bahria Town Phase 6", 33.5200, 73.0900),
    ("Bahria Town Phase 7", 33.5120, 73.0800),
    ("Bahria Town Phase 8", 33.5000, 73.0700),
    # Rawalpindi Hubs
    ("Saddar", 33.5960, 73.0540),
    ("Satellite Town", 33.6390, 73.0680),
    ("Westridge", 33.6067, 73.0233),
]


def seed_location_cache(db) -> None:
    """Idempotently seed the location_cache table with Islamabad/Rawalpindi sectors."""
    existing_queries = {r[0] for r in db.query(LocationCache.query).all()}
    new_entries = []

    for name, lat, lon in _INITIAL_LOCATIONS:
        # Standard query format used by geocode_location
        queries_to_add = [
            f"{name.strip().lower()}, islamabad, pakistan",
            name.strip().lower(),
        ]
        # Common variations: e.g. G-13 -> G13, DHA Phase 3 -> DHA 3
        if "-" in name:
            queries_to_add.append(f"{name.replace('-', '').strip().lower()}, islamabad, pakistan")
            queries_to_add.append(name.replace('-', '').strip().lower())
        if "Phase " in name:
            short_phase = name.replace("Phase ", "").strip().lower()
            queries_to_add.append(f"{short_phase}, islamabad, pakistan")
            queries_to_add.append(short_phase)

        for q in queries_to_add:
            if q not in existing_queries:
                new_entries.append(LocationCache(query=q, latitude=lat, longitude=lon))
                existing_queries.add(q)

    if new_entries:
        db.add_all(new_entries)
        db.commit()


async def run_startup_tasks() -> None:
    """Execute all one-time startup tasks for the application."""
    init_db()

    # Initialize PostgreSQL checkpoint tables (no-op on SQLite)
    await _setup_postgres_checkpointer()

    # Seed initial service types if table is empty
    with get_db_session() as db:
        if db.query(ServiceType).count() == 0:
            db.add_all([
                ServiceType(
                    key="electrician",
                    label="Electrician",
                    label_urdu="BIJLI WALA",
                    aliases="bijli wala, electrician, bijli",
                    theme_color="#3B82F6",
                    description="Ghar ki wiring, UPS, aur bijli ke har tarah ke masle.",
                    sort_order=1
                ),
                ServiceType(
                    key="plumber",
                    label="Plumber",
                    label_urdu="NALQE WALA",
                    aliases="nalqe wala, plumber, pani",
                    theme_color="#22C55E",
                    description="Pipes, motor, aur paani ki har tarah ki repair.",
                    sort_order=2
                )
            ])
            db.commit()
            refresh_valid_service_types()

        # Seed location cache with common Islamabad/Rawalpindi sectors (<1ms cache hits)
        seed_location_cache(db)
