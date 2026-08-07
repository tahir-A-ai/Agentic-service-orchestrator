"""
app/api/__init__.py
====================
Re-exports api_router from the versioned v1 sub-package.
main.py mounts this at prefix="/api/v1" — no URL changes for consumers.
"""

from app.api.v1 import v1_router as api_router

__all__ = ["api_router"]
