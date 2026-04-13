from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.services.extractor import extract_project

router = APIRouter()


MAX_SOURCE_LENGTH = 50_000  # ~12k tokens, enough for several lectures
MAX_PDF_BYTES = 20 * 1024 * 1024  # 20 MB


class IngestTextRequest(BaseModel):
    source_text: str = Field(min_length=1, max_length=MAX_SOURCE_LENGTH)
    user_focus: str = Field(default="", max_length=500)


@router.post("/ingest/text")
async def ingest_text(payload: IngestTextRequest):
    try:
        project = await extract_project(payload.source_text, payload.user_focus)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return project.model_dump()


@router.post("/ingest/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    user_focus: str = Form(""),
):
    if file.content_type not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=422, detail="PDF exceeds 20 MB limit.")

    # Extract text as Markdown (preserves headings, tables, lists)
    import pymupdf4llm

    try:
        md_text = pymupdf4llm.to_markdown(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read PDF: {e}")

    if not md_text or not md_text.strip():
        raise HTTPException(status_code=422, detail="PDF contains no extractable text.")

    # Truncate to source length limit
    source_text = md_text[:MAX_SOURCE_LENGTH]

    try:
        project = await extract_project(source_text, user_focus)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return project.model_dump()
