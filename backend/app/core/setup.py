"""
app/core/setup.py
=================
Startup routines and initialization logic for the FastAPI application.
"""

from app.services.database import init_db, get_db_session
from app.models import ServiceType
from app.services.tools import refresh_valid_service_types

def run_startup_tasks() -> None:
    """
    Execute all one-time startup tasks for the application.
    Creates all database tables via SQLAlchemy if they do not exist,
    and seeds the initial service types.
    """
    init_db()

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
