"""Schema validation tests.

Guards the public API contract between the LLM pipeline, the jobs registry,
and the frontend: rejects bad enum values, enforces importance bounds, and
keeps defaults in sync with what the extractor relies on.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.blocks import (
    Block,
    BlockType,
    CheatsheetProject,
    Compressibility,
    ExamProfile,
    ListLayout,
    ListPage,
    MindmapLayout,
    MindmapPage,
)
from app.schemas.jobs import JobProgress, JobStage, JobStatus


# ---------------------------------------------------------------------------
# Block
# ---------------------------------------------------------------------------


def test_block_minimal_applies_defaults():
    b = Block(id="b1", type=BlockType.definition, title="X")
    assert b.content == ""
    assert b.parent_id is None
    assert b.importance == 0.5
    assert b.compressibility == Compressibility.medium
    assert b.must_keep is False
    assert b.latex is None
    assert b.image_data is None


def test_block_rejects_unknown_type():
    with pytest.raises(ValidationError):
        Block(id="b", type="gremlin", title="x")


def test_block_rejects_unknown_compressibility():
    with pytest.raises(ValidationError):
        Block(
            id="b",
            type=BlockType.definition,
            title="x",
            compressibility="extreme",
        )


@pytest.mark.parametrize("value", [-0.01, 1.01, 5.0, -100.0])
def test_block_rejects_importance_out_of_unit_interval(value):
    with pytest.raises(ValidationError):
        Block(id="b", type=BlockType.definition, title="x", importance=value)


@pytest.mark.parametrize("value", [0.0, 0.25, 0.5, 0.75, 1.0])
def test_block_accepts_importance_boundary_values(value):
    b = Block(id="b", type=BlockType.definition, title="x", importance=value)
    assert b.importance == value


def test_block_accepts_image_block_with_metadata():
    b = Block(
        id="img",
        type=BlockType.image,
        title="Diagram",
        image_data="data:image/png;base64,AAAA",
        image_width="medium",
        image_caption="Figure 1",
    )
    assert b.type == BlockType.image
    assert b.image_width == "medium"
    assert b.image_caption == "Figure 1"


def test_block_rejects_unknown_image_width():
    with pytest.raises(ValidationError):
        Block(
            id="img",
            type=BlockType.image,
            title="x",
            image_width="gigantic",
        )


# ---------------------------------------------------------------------------
# ExamProfile / Layouts
# ---------------------------------------------------------------------------


def test_exam_profile_defaults():
    p = ExamProfile()
    assert p.exam_type == "mixed"
    assert p.target_pages == 2
    assert p.priority_mode == "balanced"


def test_exam_profile_rejects_bad_exam_type():
    with pytest.raises(ValidationError):
        ExamProfile(exam_type="essay")


@pytest.mark.parametrize("cls", [ListLayout, MindmapLayout])
@pytest.mark.parametrize("level", [0, 6, 10, -1])
def test_layout_density_level_bounded_1_to_5(cls, level):
    with pytest.raises(ValidationError):
        cls(density_level=level)


@pytest.mark.parametrize("cls", [ListLayout, MindmapLayout])
def test_layout_density_level_accepts_valid_range(cls):
    for level in (1, 2, 3, 4, 5):
        assert cls(density_level=level).density_level == level


def test_mindmap_layout_rejects_bad_orientation():
    with pytest.raises(ValidationError):
        MindmapLayout(orientation="diagonal")


# ---------------------------------------------------------------------------
# Page discriminated union
# ---------------------------------------------------------------------------


def test_list_and_mindmap_pages_carry_mode_tag():
    list_page = ListPage(id="p1", layout=ListLayout(), block_ids=["a", "b"])
    mind_page = MindmapPage(id="p2", layout=MindmapLayout(), block_ids=["c"])
    assert list_page.mode == "list"
    assert mind_page.mode == "mindmap"


# ---------------------------------------------------------------------------
# CheatsheetProject
# ---------------------------------------------------------------------------


def test_project_serializes_and_roundtrips():
    proj = CheatsheetProject(
        document_title="Roundtrip",
        blocks=[Block(id="b1", type=BlockType.definition, title="X")],
        pages=[
            ListPage(id="p1", layout=ListLayout(), block_ids=["b1"]),
        ],
    )
    dumped = proj.model_dump()
    assert dumped["document_title"] == "Roundtrip"
    assert dumped["warnings"] == []

    restored = CheatsheetProject.model_validate(dumped)
    assert restored.blocks[0].id == "b1"
    assert restored.pages[0].mode == "list"


def test_project_requires_document_title():
    with pytest.raises(ValidationError):
        CheatsheetProject(blocks=[], pages=[])


# ---------------------------------------------------------------------------
# JobProgress
# ---------------------------------------------------------------------------


def test_job_progress_minimal():
    j = JobProgress(job_id="abc123")
    assert j.status == JobStatus.pending
    assert j.stage is None
    assert j.warnings == []
    assert j.result is None
    # default_factory runs twice so the two timestamps differ by microseconds;
    # assert they're populated and close rather than strictly equal.
    assert abs((j.updated_at - j.created_at).total_seconds()) < 0.01


def test_job_progress_rejects_bad_status_and_stage():
    with pytest.raises(ValidationError):
        JobProgress(job_id="abc", status="weird")
    with pytest.raises(ValidationError):
        JobProgress(job_id="abc", stage="zzz")


def test_job_progress_accepts_embedded_project_result():
    proj = CheatsheetProject(
        document_title="R",
        blocks=[],
        pages=[],
    )
    j = JobProgress(
        job_id="x",
        status=JobStatus.completed,
        stage=JobStage.compress,
        result=proj,
    )
    dumped = j.model_dump(mode="json")
    assert dumped["status"] == "completed"
    assert dumped["stage"] == "compress"
    assert dumped["result"]["document_title"] == "R"
