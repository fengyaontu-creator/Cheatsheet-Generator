from typing import List, Optional

from pydantic import BaseModel, Field


class ExportBlockRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(default="", max_length=5_000)
    latex: Optional[str] = Field(default=None, max_length=1_000)


class ExportRequest(BaseModel):
    document_title: str = Field(default="Cheatsheet", min_length=1, max_length=120)
    blocks: List[ExportBlockRequest] = Field(min_length=1, max_length=200)
    cols: int = Field(default=2, ge=1, le=3)
    margin_mm: int = Field(default=10, ge=5, le=25)
