from typing import List

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.services.extractor import extract_project

router = APIRouter()


MAX_SOURCE_LENGTH = 50_000  # ~12k tokens, enough for several lectures
MAX_PDF_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_IMAGES = 10
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB per image
VALID_LANGUAGES = {"en", "zh", "mixed"}
VALID_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}


async def _read_images(files: list[UploadFile]) -> list[bytes]:
    """Validate and read uploaded image files."""
    if len(files) > MAX_IMAGES:
        raise HTTPException(
            status_code=422, detail=f"Too many images (max {MAX_IMAGES})."
        )
    images: list[bytes] = []
    for f in files:
        if f.content_type not in VALID_IMAGE_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid image type: {f.content_type}. Accepted: png, jpeg, webp, gif.",
            )
        data = await f.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=422,
                detail=f"Image '{f.filename}' exceeds 5 MB limit.",
            )
        images.append(data)
    return images


@router.post("/ingest/text")
async def ingest_text(
    source_text: str = Form(...),
    user_focus: str = Form(""),
    language: str = Form("en"),
    images: List[UploadFile] = File(default=[]),
    debug: bool = Query(False),
):
    if not source_text or not source_text.strip():
        raise HTTPException(status_code=422, detail="Source text is empty.")
    if len(source_text) > MAX_SOURCE_LENGTH:
        source_text = source_text[:MAX_SOURCE_LENGTH]

    lang = language if language in VALID_LANGUAGES else "en"
    image_bytes = await _read_images(images) if images else None

    try:
        project = await extract_project(
            source_text, user_focus, lang, debug=debug, images=image_bytes
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return project.model_dump()


@router.post("/ingest/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    user_focus: str = Form(""),
    language: str = Form("en"),
    images: List[UploadFile] = File(default=[]),
    debug: bool = Query(False),
):
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=422, detail="PDF exceeds 20 MB limit.")

    import pymupdf4llm

    try:
        md_text = pymupdf4llm.to_markdown(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read PDF: {e}")

    if not md_text or not md_text.strip():
        raise HTTPException(status_code=422, detail="PDF contains no extractable text.")

    source_text = md_text[:MAX_SOURCE_LENGTH]
    lang = language if language in VALID_LANGUAGES else "en"
    image_bytes = await _read_images(images) if images else None

    try:
        project = await extract_project(
            source_text, user_focus, lang, debug=debug, images=image_bytes
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return project.model_dump()
