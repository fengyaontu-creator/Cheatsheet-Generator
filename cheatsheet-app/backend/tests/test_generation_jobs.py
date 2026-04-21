"""Unit tests for app.services.generation_jobs.

The registry is a module-level dict with FIFO eviction at MAX_JOBS. These
tests verify the lifecycle (pending → running → completed/failed), progress
updates from the extractor's sync callback, and eviction ordering.

conftest.py clears the registry before and after every test via an autouse
fixture, so tests can rely on a clean slate.
"""

from __future__ import annotations

import asyncio

import pytest

from app.schemas.blocks import CheatsheetProject, ExamProfile
from app.schemas.jobs import JobStage, JobStatus
from app.services import generation_jobs


def _empty_project(title: str = "Test", warnings: list[str] | None = None) -> CheatsheetProject:
    return CheatsheetProject(
        document_title=title,
        exam_profile=ExamProfile(),
        blocks=[],
        pages=[],
        warnings=warnings or [],
    )


# ---------------------------------------------------------------------------
# create / get / update
# ---------------------------------------------------------------------------


async def test_create_job_returns_unique_id_and_pending_state():
    id1 = await generation_jobs.create_job()
    id2 = await generation_jobs.create_job()

    assert id1 != id2
    job1 = await generation_jobs.get_job(id1)
    assert job1 is not None
    assert job1.job_id == id1
    assert job1.status == JobStatus.pending
    assert job1.stage is None


async def test_get_unknown_job_returns_none():
    assert await generation_jobs.get_job("does-not-exist") is None


async def test_update_job_merges_fields_and_bumps_updated_at():
    job_id = await generation_jobs.create_job()
    before = await generation_jobs.get_job(job_id)

    await asyncio.sleep(0.001)  # ensure updated_at strictly advances
    await generation_jobs.update_job(
        job_id, status=JobStatus.running, stage=JobStage.topics, topics_total=3
    )

    after = await generation_jobs.get_job(job_id)
    assert after.status == JobStatus.running
    assert after.stage == JobStage.topics
    assert after.topics_total == 3
    assert after.updated_at >= before.updated_at
    assert after.created_at == before.created_at


async def test_update_unknown_job_is_noop():
    # Should not raise — silently drop updates for evicted/unknown jobs.
    await generation_jobs.update_job("ghost", status=JobStatus.completed)
    assert await generation_jobs.get_job("ghost") is None


# ---------------------------------------------------------------------------
# FIFO eviction
# ---------------------------------------------------------------------------


async def test_fifo_eviction_when_exceeding_max_jobs(monkeypatch):
    monkeypatch.setattr(generation_jobs, "MAX_JOBS", 3)

    ids = [await generation_jobs.create_job() for _ in range(4)]

    # The first one inserted must be the one evicted.
    assert await generation_jobs.get_job(ids[0]) is None
    for j in ids[1:]:
        assert await generation_jobs.get_job(j) is not None

    # Registry size should be exactly MAX_JOBS.
    assert len(generation_jobs._jobs) == 3


# ---------------------------------------------------------------------------
# update_progress_sync (extractor callback hook)
# ---------------------------------------------------------------------------


async def test_progress_sync_translates_stage_to_running():
    job_id = await generation_jobs.create_job()

    generation_jobs.update_progress_sync(
        job_id,
        {"stage": "outline", "topics_total": 4, "topics_done": 2},
    )
    # Scheduled via loop.create_task — let the event loop run it.
    await asyncio.sleep(0)

    job = await generation_jobs.get_job(job_id)
    assert job.status == JobStatus.running
    assert job.stage == JobStage.outline
    assert job.topics_total == 4
    assert job.topics_done == 2


async def test_progress_sync_without_running_loop_is_dropped():
    """Outside an event loop, the callback must fail silently — the extractor
    runs stages inside asyncio.to_thread workers where no loop is bound."""
    result = {}

    def sync_caller():
        try:
            generation_jobs.update_progress_sync("whatever", {"stage": "topics"})
            result["ok"] = True
        except Exception as e:
            result["err"] = e

    # Run in a thread where no asyncio loop is attached.
    await asyncio.to_thread(sync_caller)
    assert result == {"ok": True}


# ---------------------------------------------------------------------------
# run_job (terminal state)
# ---------------------------------------------------------------------------


async def test_run_job_success_records_result_and_warnings():
    job_id = await generation_jobs.create_job()
    proj = _empty_project(title="Done", warnings=["soft-warn"])

    async def extract():
        return proj

    await generation_jobs.run_job(job_id, extract)

    job = await generation_jobs.get_job(job_id)
    assert job.status == JobStatus.completed
    assert job.result is not None
    assert job.result.document_title == "Done"
    assert job.warnings == ["soft-warn"]
    assert job.error is None


async def test_run_job_failure_records_error_message():
    job_id = await generation_jobs.create_job()

    async def extract():
        raise ValueError("boom")

    await generation_jobs.run_job(job_id, extract)

    job = await generation_jobs.get_job(job_id)
    assert job.status == JobStatus.failed
    assert job.error == "boom"
    assert job.result is None


async def test_run_job_repr_fallback_on_empty_error():
    """An exception with an empty str() must still produce a non-empty error."""
    job_id = await generation_jobs.create_job()

    class Blank(Exception):
        def __str__(self):
            return ""

    async def extract():
        raise Blank()

    await generation_jobs.run_job(job_id, extract)

    job = await generation_jobs.get_job(job_id)
    assert job.status == JobStatus.failed
    assert job.error  # non-empty via repr() fallback


async def test_run_job_cancellation_marks_failed_and_reraises():
    job_id = await generation_jobs.create_job()

    async def extract():
        raise asyncio.CancelledError()

    with pytest.raises(asyncio.CancelledError):
        await generation_jobs.run_job(job_id, extract)

    job = await generation_jobs.get_job(job_id)
    assert job.status == JobStatus.failed
    assert "cancel" in (job.error or "").lower()


# ---------------------------------------------------------------------------
# spawn_job
# ---------------------------------------------------------------------------


async def test_spawn_job_runs_in_background_and_completes():
    job_id = await generation_jobs.create_job()
    proj = _empty_project(title="BG")

    async def extract():
        await asyncio.sleep(0)
        return proj

    task = generation_jobs.spawn_job(job_id, extract)
    assert job_id in generation_jobs._tasks
    await task

    job = await generation_jobs.get_job(job_id)
    assert job.status == JobStatus.completed
    assert job.result.document_title == "BG"
