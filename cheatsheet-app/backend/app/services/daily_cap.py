"""Per-day generation counter used as a cost backstop on the public URL.

Single-process uvicorn keeps a lightweight in-memory counter keyed by UTC
date. When the configured cap is reached, further ingest calls return 429.
Resets automatically at the UTC day boundary.
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from fastapi import HTTPException

_DEFAULT_CAP = 200

_lock = asyncio.Lock()
_counter: dict[str, int] = {}


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _cap() -> int:
    raw = os.getenv("DAILY_GENERATION_CAP", "").strip()
    if not raw:
        return _DEFAULT_CAP
    try:
        value = int(raw)
    except ValueError:
        return _DEFAULT_CAP
    return max(1, value)


async def check_and_increment() -> None:
    """Raise 429 if the UTC-day cap is reached; otherwise bump the counter."""
    cap = _cap()
    today = _today()

    async with _lock:
        current = _counter.get(today, 0)
        if current >= cap:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Daily generation cap ({cap}) reached on this server. "
                    "Please try again after 00:00 UTC."
                ),
            )
        _counter[today] = current + 1
        _cleanup_old_days(today)


def _cleanup_old_days(today: str) -> None:
    stale = [k for k in _counter if k != today]
    for k in stale:
        del _counter[k]


async def _reset_for_tests() -> None:
    """Test helper: wipe the counter so each test starts fresh."""
    async with _lock:
        _counter.clear()
