from enum import Enum
from typing import List, Literal, Optional, Union
from pydantic import BaseModel, Field


class BlockType(str, Enum):
    topic = "topic"
    definition = "definition"
    formula = "formula"
    comparison = "comparison"
    pitfall = "pitfall"
    procedure = "procedure"
    exam_tip = "exam_tip"
    example = "example"


class Compressibility(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class Block(BaseModel):
    id: str
    type: BlockType
    title: str
    content: str = ""
    parent_id: Optional[str] = None
    content_short: Optional[str] = None
    content_ultra_short: Optional[str] = None
    latex: Optional[str] = None
    importance: float = Field(ge=0.0, le=1.0, default=0.5)
    compressibility: Compressibility = Compressibility.medium
    must_keep: bool = False
    source_ref: Optional[str] = None


class ExamProfile(BaseModel):
    exam_type: Literal["MCQ", "short", "mixed"] = "mixed"
    target_pages: int = 2
    priority_mode: Literal["balanced", "formula", "definition", "pitfall", "cram"] = "balanced"


class ListLayout(BaseModel):
    columns: int = 2
    font_size_pt: float = 8.0
    line_height: float = 1.15
    margin_mm: float = 10.0
    density_level: int = Field(ge=1, le=5, default=3)


class MindmapLayout(BaseModel):
    orientation: Literal["horizontal", "vertical"] = "horizontal"
    font_size_pt: float = 8.0
    margin_mm: float = 10.0
    level_gap_mm: float = 40.0
    sibling_gap_mm: float = 6.0
    density_level: int = Field(ge=1, le=5, default=3)


class ListPage(BaseModel):
    id: str
    mode: Literal["list"] = "list"
    layout: ListLayout
    block_ids: List[str]


class MindmapPage(BaseModel):
    id: str
    mode: Literal["mindmap"] = "mindmap"
    layout: MindmapLayout
    block_ids: List[str]


Page = Union[ListPage, MindmapPage]


class CheatsheetProject(BaseModel):
    document_title: str
    exam_profile: ExamProfile = ExamProfile()
    blocks: List[Block]
    pages: List[Page]
