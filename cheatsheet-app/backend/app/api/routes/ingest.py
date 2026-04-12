from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.extractor import extract_project

router = APIRouter()


class IngestTextRequest(BaseModel):
    source_text: str = Field(min_length=1)
    user_focus: str = ""


@router.post("/ingest/text")
async def ingest_text(payload: IngestTextRequest):
    try:
        project = await extract_project(payload.source_text, payload.user_focus)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return project.model_dump()
