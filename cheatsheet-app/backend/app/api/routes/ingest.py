from typing import List

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.services import generation_jobs
from app.services.extractor import extract_project
from app.services.file_reader import (
    extract_text_from_files,
    is_image,
    is_supported_document,
)

router = APIRouter()

MAX_SOURCE_LENGTH = 50_000  # ~12k tokens
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB per file
MAX_FILES = 10
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB per image
VALID_LANGUAGES = {"en", "zh", "mixed"}


async def _prepare_source_from_files(
    files: List[UploadFile],
) -> tuple[str, list[bytes]]:
    """Validate uploads and return (source_text, images). Raises HTTPException on bad input."""
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=422, detail=f"Too many files (max {MAX_FILES}).")

    documents: list[tuple[str, bytes]] = []
    images: list[bytes] = []

    for f in files:
        data = await f.read()

        if is_image(f.content_type, f.filename):
            if len(data) > MAX_IMAGE_BYTES:
                raise HTTPException(
                    status_code=422,
                    detail=f"Image '{f.filename}' exceeds 5 MB limit.",
                )
            images.append(data)
        else:
            if len(data) > MAX_FILE_BYTES:
                raise HTTPException(
                    status_code=422,
                    detail=f"File '{f.filename}' exceeds 20 MB limit.",
                )
            if not is_supported_document(f.filename):
                raise HTTPException(
                    status_code=422,
                    detail=f"Unsupported file type: '{f.filename}'. "
                    "Accepted: PDF, Word, Excel, PowerPoint, HTML, CSV, JSON, XML, plain text.",
                )
            documents.append((f.filename or "file", data))

    if not documents:
        raise HTTPException(
            status_code=422,
            detail="No document files provided. Upload at least one document "
            "(PDF, Word, Excel, etc.).",
        )

    try:
        source_text = await extract_text_from_files(documents)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read file: {e}")

    if not source_text.strip():
        raise HTTPException(status_code=422, detail="Files contain no extractable text.")

    return source_text[:MAX_SOURCE_LENGTH], images


def _validate_text_source(source: str) -> str:
    if not source or not source.strip():
        raise HTTPException(status_code=422, detail="Source text is empty.")
    return source[:MAX_SOURCE_LENGTH]


def _normalize_language(language: str) -> str:
    return language if language in VALID_LANGUAGES else "en"


# ---------- POST /api/ingest  (unified file upload, synchronous) ----------

@router.post("/ingest")
async def ingest_files(
    files: List[UploadFile] = File(...),
    user_focus: str = Form(""),
    language: str = Form("en"),
    debug: bool = Query(False),
):
    """
    Accept any combination of document files and images.

    Documents (PDF, Word, Excel, PPT, HTML, CSV, etc.) are converted to text
    via markitdown, then fed into the LLM extraction pipeline.

    Images are collected separately for future multimodal use but do NOT
    participate in the Stage 0-3 pipeline in V1.
    """
    source_text, _images = await _prepare_source_from_files(files)
    lang = _normalize_language(language)

    try:
        project = await extract_project(source_text, user_focus, lang, debug=debug)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return project.model_dump()


# ---------- POST /api/ingest/text  (paste text, synchronous) ----------

class IngestTextRequest(BaseModel):
    source_text: str
    user_focus: str = ""
    language: str = "en"


@router.post("/ingest/text")
async def ingest_text(
    body: IngestTextRequest,
    debug: bool = Query(False),
):
    """Accept pasted text and feed it into the extraction pipeline."""
    source_text = _validate_text_source(body.source_text)
    lang = _normalize_language(body.language)

    try:
        project = await extract_project(source_text, body.user_focus, lang, debug=debug)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return project.model_dump()


# ---------- Async job endpoints (Track 3 Phase 1) ----------

@router.post("/ingest/jobs/files", status_code=202)
async def ingest_files_job(
    files: List[UploadFile] = File(...),
    user_focus: str = Form(""),
    language: str = Form("en"),
    debug: bool = Query(False),
):
    """Fire-and-forget file ingest. Returns a job_id to poll."""
    source_text, _images = await _prepare_source_from_files(files)
    lang = _normalize_language(language)
    job_id = await generation_jobs.create_job()

    async def _run():
        return await extract_project(
            source_text,
            user_focus,
            lang,
            debug=debug,
            on_progress=lambda ev: generation_jobs.update_progress_sync(job_id, ev),
        )

    generation_jobs.spawn_job(job_id, _run)
    return {"job_id": job_id}


@router.post("/ingest/jobs/text", status_code=202)
async def ingest_text_job(
    body: IngestTextRequest,
    debug: bool = Query(False),
):
    """Fire-and-forget text ingest. Returns a job_id to poll."""
    source_text = _validate_text_source(body.source_text)
    lang = _normalize_language(body.language)
    job_id = await generation_jobs.create_job()
    user_focus = body.user_focus

    async def _run():
        return await extract_project(
            source_text,
            user_focus,
            lang,
            debug=debug,
            on_progress=lambda ev: generation_jobs.update_progress_sync(job_id, ev),
        )

    generation_jobs.spawn_job(job_id, _run)
    return {"job_id": job_id}


@router.get("/ingest/jobs/{job_id}")
async def get_ingest_job(job_id: str):
    job = await generation_jobs.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job.model_dump(mode="json")
