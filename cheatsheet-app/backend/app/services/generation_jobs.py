"""In-memory registry for generation jobs.

Jobs are short-lived (one pipeline run), held in a process-local dict, and
evicted FIFO once we exceed MAX_JOBS. This is deliberately simple — single
instance, single user. If we ever run multiple workers or need persistence,
swap this module's internals for Redis / DB without touching callers.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections import OrderedDict
from typing import Any, Awaitable, Callable, Optional

from app.schemas.blocks import CheatsheetProject
from app.schemas.jobs import JobProgress, JobStage, JobStatus, _utcnow

logger = logging.getLogger(__name__)

MAX_JOBS = 50

_jobs: "OrderedDict[str, JobProgress]" = OrderedDict()
_tasks: dict[str, asyncio.Task] = {}
_lock = asyncio.Lock()


def _evict_if_needed() -> None:
    while len(_jobs) > MAX_JOBS:
        job_id, _ = _jobs.popitem(last=False)
        _tasks.pop(job_id, None)


async def create_job() -> str:
    job_id = uuid.uuid4().hex
    async with _lock:
        _jobs[job_id] = JobProgress(job_id=job_id, status=JobStatus.pending)
        _evict_if_needed()
    return job_id


async def update_job(job_id: str, **fields: Any) -> None:
    async with _lock:
        current = _jobs.get(job_id)
        if current is None:
            return
        data = current.model_dump()
        data.update(fields)
        data["updated_at"] = _utcnow()
        _jobs[job_id] = JobProgress(**data)


async def get_job(job_id: str) -> Optional[JobProgress]:
    async with _lock:
        return _jobs.get(job_id)


def update_progress_sync(job_id: str, event: dict[str, Any]) -> None:
    """Sync-callback entry point used by the extractor's `on_progress` hook.

    The extractor runs stages inside asyncio.to_thread workers and also on the
    event loop; a sync callback keeps the hot path cheap. We schedule the
    async update on the running loop without awaiting it.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.debug("progress update dropped (no running loop): %s", event)
        return

    normalized: dict[str, Any] = {}
    if "stage" in event:
        normalized["stage"] = JobStage(event["stage"])
        normalized["status"] = JobStatus.running
    if "topics_total" in event:
        normalized["topics_total"] = event["topics_total"]
    if "topics_done" in event:
        normalized["topics_done"] = event["topics_done"]

    loop.create_task(update_job(job_id, **normalized))


async def run_job(
    job_id: str,
    extract_fn: Callable[[], Awaitable[CheatsheetProject]],
) -> None:
    """Run the pipeline coroutine and record terminal state."""
    await update_job(job_id, status=JobStatus.running)
    try:
        project = await extract_fn()
    except asyncio.CancelledError:
        await update_job(job_id, status=JobStatus.failed, error="Job cancelled.")
        raise
    except Exception as e:
        logger.exception("Job %s failed", job_id)
        detail = str(e).strip() or repr(e)
        await update_job(job_id, status=JobStatus.failed, error=detail)
        return

    await update_job(
        job_id,
        status=JobStatus.completed,
        result=project,
        warnings=list(project.warnings),
    )


def spawn_job(
    job_id: str,
    extract_fn: Callable[[], Awaitable[CheatsheetProject]],
) -> asyncio.Task:
    task = asyncio.create_task(run_job(job_id, extract_fn))
    _tasks[job_id] = task
    return task
