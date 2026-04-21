"""Shared pytest fixtures.

Isolates the in-memory job registry between tests so order-dependent FIFO
behaviour can be asserted deterministically.
"""

from __future__ import annotations

import pytest

from app.services import generation_jobs


@pytest.fixture(autouse=True)
def reset_job_registry():
    """Wipe the module-level job dicts around every test."""
    generation_jobs._jobs.clear()
    generation_jobs._tasks.clear()
    yield
    generation_jobs._jobs.clear()
    generation_jobs._tasks.clear()
