"""End-to-end smoke test for the async ingest jobs API.

`POST /api/ingest/jobs/text` must return 202 + job_id, and the subsequent
`GET /api/ingest/jobs/{id}` must surface the pipeline outcome. The LLM call
is stubbed via monkeypatch so the test runs offline.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.blocks import Block, BlockType, CheatsheetProject, ListLayout, ListPage
from app.api.routes import ingest as ingest_routes


@pytest.fixture
def client():
    return TestClient(app)


def _stub_project() -> CheatsheetProject:
    return CheatsheetProject(
        document_title="Stub",
        blocks=[Block(id="b1", type=BlockType.definition, title="Stub block")],
        pages=[ListPage(id="p1", layout=ListLayout(), block_ids=["b1"])],
        warnings=["stubbed"],
    )


def test_post_text_job_returns_202_and_completes(client, monkeypatch):
    async def fake_extract(*args, **kwargs):
        return _stub_project()

    monkeypatch.setattr(ingest_routes, "extract_project", fake_extract)

    resp = client.post(
        "/api/ingest/jobs/text",
        json={"source_text": "Any source text will do.", "user_focus": "", "language": "en"},
    )
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]
    assert isinstance(job_id, str) and job_id

    # Poll briefly — TestClient runs the app on its own loop so the spawned
    # task usually finishes inside the POST, but the GET may race. Give it a
    # handful of attempts before asserting completion.
    for _ in range(20):
        get_resp = client.get(f"/api/ingest/jobs/{job_id}")
        assert get_resp.status_code == 200
        body = get_resp.json()
        if body["status"] in ("completed", "failed"):
            break

    assert body["status"] == "completed", body
    assert body["job_id"] == job_id
    assert body["result"]["document_title"] == "Stub"
    assert body["warnings"] == ["stubbed"]


def test_get_unknown_job_returns_404(client):
    resp = client.get("/api/ingest/jobs/definitely-not-a-real-id")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_post_text_job_rejects_empty_source(client):
    resp = client.post(
        "/api/ingest/jobs/text",
        json={"source_text": "   ", "user_focus": "", "language": "en"},
    )
    assert resp.status_code == 422


def test_post_text_job_surfaces_failed_status(client, monkeypatch):
    async def exploding_extract(*args, **kwargs):
        raise ValueError("LLM refused")

    monkeypatch.setattr(ingest_routes, "extract_project", exploding_extract)

    resp = client.post(
        "/api/ingest/jobs/text",
        json={"source_text": "doesn't matter", "user_focus": "", "language": "en"},
    )
    assert resp.status_code == 202
    job_id = resp.json()["job_id"]

    for _ in range(20):
        body = client.get(f"/api/ingest/jobs/{job_id}").json()
        if body["status"] in ("completed", "failed"):
            break

    assert body["status"] == "failed"
    assert "LLM refused" in (body["error"] or "")
