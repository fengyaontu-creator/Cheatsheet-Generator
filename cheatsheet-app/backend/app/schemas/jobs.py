from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.blocks import CheatsheetProject


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobStage(str, Enum):
    comprehend = "comprehend"
    topics = "topics"
    outline = "outline"
    compress = "compress"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobProgress(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.pending
    stage: Optional[JobStage] = None
    topics_total: Optional[int] = None
    topics_done: Optional[int] = None
    warnings: List[str] = Field(default_factory=list)
    result: Optional[CheatsheetProject] = None
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
