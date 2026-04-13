import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any

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
from app.services.llm_client import LLMClient, load_prompt
from app.services.outline_parser import parse_outline

VALID_BLOCK_TYPES = {bt.value for bt in BlockType if bt.value != "topic"}
VALID_COMPRESSIBILITY = {c.value for c in Compressibility}
MAX_TOPICS = 12
MAX_WORKERS = 4


async def extract_project(source_text: str, user_focus: str) -> CheatsheetProject:
    client = LLMClient()
    focus = user_focus.strip() or "none"
    warnings: list[str] = []

    # Stage 1: topic extraction (unchanged)
    outline = await asyncio.to_thread(_extract_topics, client, source_text, focus)
    document_title = outline.get("document_title") or "Untitled cheatsheet"
    raw_topics = outline.get("topics") or []
    if not raw_topics:
        raise ValueError("LLM returned no topics — source may be too short or unparseable")

    if len(raw_topics) > MAX_TOPICS:
        warnings.append(
            f"Trimmed topic extraction from {len(raw_topics)} to {MAX_TOPICS} topics for stability."
        )
    topics = [_normalize_topic(t, idx) for idx, t in enumerate(raw_topics[:MAX_TOPICS])]

    # Stage 2: hierarchical outline extraction per topic (parallel)
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(topics))) as pool:
        futures = [
            loop.run_in_executor(
                pool, _extract_outline_for_topic, client, source_text, focus, t, topics
            )
            for t in topics
        ]
        results = await asyncio.gather(*futures, return_exceptions=True)

    all_blocks: list[Block] = []
    failed_topics: list[str] = []
    for topic, result in zip(topics, results):
        topic_block = Block(
            id=topic["id"],
            type=BlockType.topic,
            title=topic["title"],
            content="",
            parent_id=None,
            importance=topic["importance"],
            compressibility=Compressibility.low,
            must_keep=topic["must_keep"],
        )
        all_blocks.append(topic_block)

        if isinstance(result, Exception):
            failed_topics.append(topic["title"])
            continue
        for raw_block in result:
            block = _normalize_outline_block(raw_block)
            if block is not None:
                all_blocks.append(block)

    if failed_topics:
        warnings.append(
            "Failed to extract some topics: " + ", ".join(failed_topics[:4])
            + ("." if len(failed_topics) <= 4 else ", and more.")
        )

    if not any(b.type != BlockType.topic for b in all_blocks):
        raise RuntimeError("All topic outline extraction passes failed.")

    content_ids = [b.id for b in all_blocks if b.type != BlockType.topic]
    list_page = ListPage(
        id="p_list",
        mode="list",
        layout=ListLayout(),
        block_ids=content_ids,
    )
    mindmap_page = MindmapPage(
        id="p_mindmap",
        mode="mindmap",
        layout=MindmapLayout(),
        block_ids=content_ids,
    )

    return CheatsheetProject(
        document_title=document_title,
        exam_profile=ExamProfile(),
        blocks=all_blocks,
        pages=[list_page, mindmap_page],
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Stage 1: topics (unchanged)
# ---------------------------------------------------------------------------


def _extract_topics(
    client: LLMClient, source_text: str, user_focus: str
) -> dict[str, Any]:
    system = load_prompt("system")
    template = load_prompt("extract_topics")
    user = template.replace("{user_focus}", user_focus).replace(
        "{source_text}", source_text
    )
    return client.complete_json(system, user)


# ---------------------------------------------------------------------------
# Stage 2: hierarchical outline per topic
# ---------------------------------------------------------------------------


def _extract_outline_for_topic(
    client: LLMClient,
    source_text: str,
    user_focus: str,
    topic: dict[str, Any],
    all_topics: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    system = load_prompt("system")
    template = load_prompt("extract_outline")
    other_topics = "\n".join(
        f"- {t['title']}" for t in all_topics if t["id"] != topic["id"]
    ) or "- none"
    anchor_terms = ", ".join(topic.get("anchor_terms") or []) or "none"
    user = (
        template.replace("{user_focus}", user_focus)
        .replace("{source_text}", source_text)
        .replace("{topic_id}", topic["id"])
        .replace("{topic_title}", topic["title"])
        .replace("{topic_importance}", str(topic["importance"]))
        .replace("{topic_anchor_terms}", anchor_terms)
        .replace("{other_topics}", other_topics)
    )
    raw_markdown = client.complete(system, user)
    return parse_outline(raw_markdown, topic["id"])


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------


def _normalize_topic(raw: dict[str, Any], idx: int) -> dict[str, Any]:
    tid = str(raw.get("id") or f"topic_{idx}").strip() or f"topic_{idx}"
    title = str(raw.get("title") or f"Topic {idx + 1}").strip()
    importance = _clamp01(raw.get("importance"), default=0.5)
    must_keep = bool(raw.get("must_keep", False))
    anchor_terms_raw = raw.get("anchor_terms")
    if isinstance(anchor_terms_raw, list):
        anchor_terms = [
            str(term).strip() for term in anchor_terms_raw if str(term).strip()
        ]
    else:
        anchor_terms = []
    return {
        "id": tid,
        "title": title,
        "importance": importance,
        "must_keep": must_keep,
        "anchor_terms": anchor_terms[:8],
    }


def _normalize_outline_block(raw: dict[str, Any]) -> Block | None:
    """Convert a dict from outline_parser into a validated Block."""
    block_type = str(raw.get("type") or "").strip()
    if block_type not in VALID_BLOCK_TYPES:
        return None
    bid = str(raw.get("id") or "").strip()
    if not bid:
        return None
    title = str(raw.get("title") or "").strip() or "Untitled"
    content = str(raw.get("content") or "").strip()

    compressibility_raw = str(raw.get("compressibility") or "medium").strip()
    if compressibility_raw not in VALID_COMPRESSIBILITY:
        compressibility_raw = "medium"

    latex_raw = raw.get("latex")
    latex = str(latex_raw).strip() if latex_raw else None
    if latex == "":
        latex = None

    return Block(
        id=bid,
        type=BlockType(block_type),
        title=title,
        content=content,
        parent_id=raw.get("parent_id"),
        content_short=_opt_str(raw.get("content_short")),
        content_ultra_short=_opt_str(raw.get("content_ultra_short")),
        latex=latex,
        importance=_clamp01(raw.get("importance"), default=0.5),
        compressibility=Compressibility(compressibility_raw),
        must_keep=bool(raw.get("must_keep", False)),
    )


def _opt_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _clamp01(v: Any, default: float) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    if f < 0.0:
        return 0.0
    if f > 1.0:
        return 1.0
    return f
