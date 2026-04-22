"""Tests for the per-day generation cap that backstops the public URL."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.routes import ingest as ingest_routes
from app.main import app
from app.schemas.blocks import Block, BlockType, CheatsheetProject, ListLayout, ListPage
from app.services import daily_cap


@pytest.fixture
def client():
    return TestClient(app)


def _stub_project() -> CheatsheetProject:
    return CheatsheetProject(
        document_title="Stub",
        blocks=[Block(id="b1", type=BlockType.definition, title="Stub block")],
        pages=[ListPage(id="p1", layout=ListLayout(), block_ids=["b1"])],
        warnings=[],
    )


async def test_check_and_increment_under_cap(monkeypatch):
    monkeypatch.setenv("DAILY_GENERATION_CAP", "3")
    for _ in range(3):
        await daily_cap.check_and_increment()


async def test_check_and_increment_rejects_above_cap(monkeypatch):
    monkeypatch.setenv("DAILY_GENERATION_CAP", "2")
    await daily_cap.check_and_increment()
    await daily_cap.check_and_increment()
    with pytest.raises(HTTPException) as exc:
        await daily_cap.check_and_increment()
    assert exc.value.status_code == 429
    assert "Daily generation cap" in exc.value.detail


async def test_invalid_cap_env_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("DAILY_GENERATION_CAP", "not-a-number")
    # Default is 200; under it, no exception.
    await daily_cap.check_and_increment()


async def test_zero_or_negative_cap_clamps_to_one(monkeypatch):
    monkeypatch.setenv("DAILY_GENERATION_CAP", "0")
    await daily_cap.check_and_increment()
    with pytest.raises(HTTPException) as exc:
        await daily_cap.check_and_increment()
    assert exc.value.status_code == 429


def test_ingest_text_returns_429_when_cap_reached(client, monkeypatch):
    monkeypatch.setenv("DAILY_GENERATION_CAP", "1")

    async def fake_extract(*args, **kwargs):
        return _stub_project()

    monkeypatch.setattr(ingest_routes, "extract_project", fake_extract)

    first = client.post(
        "/api/ingest/text",
        json={"source_text": "anything", "user_focus": "", "language": "en"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/ingest/text",
        json={"source_text": "anything", "user_focus": "", "language": "en"},
    )
    assert second.status_code == 429
    assert "Daily generation cap" in second.json()["detail"]


def test_ingest_jobs_text_returns_429_when_cap_reached(client, monkeypatch):
    monkeypatch.setenv("DAILY_GENERATION_CAP", "1")

    async def fake_extract(*args, **kwargs):
        return _stub_project()

    monkeypatch.setattr(ingest_routes, "extract_project", fake_extract)

    first = client.post(
        "/api/ingest/jobs/text",
        json={"source_text": "anything", "user_focus": "", "language": "en"},
    )
    assert first.status_code == 202

    second = client.post(
        "/api/ingest/jobs/text",
        json={"source_text": "anything", "user_focus": "", "language": "en"},
    )
    assert second.status_code == 429
