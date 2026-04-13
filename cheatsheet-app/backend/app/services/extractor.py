import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
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

logger = logging.getLogger(__name__)

VALID_BLOCK_TYPES = {bt.value for bt in BlockType if bt.value != "topic"}
VALID_COMPRESSIBILITY = {c.value for c in Compressibility}
MAX_TOPICS = 12
MAX_WORKERS = 4

LANGUAGE_INSTRUCTIONS = {
    "en": "Output all content strictly in English.",
    "zh": "Output all content strictly in Chinese (简体中文).",
    "mixed": (
        "Output block titles and key terms in English. "
        "Output explanations, annotations, and definitions in Chinese. "
        'For important English terms, append "（中文翻译）" in parentheses. '
        "This is for a user who needs an English-language cheatsheet but benefits from Chinese explanations."
    ),
}


# ---------------------------------------------------------------------------
# Stage result types
# ---------------------------------------------------------------------------


@dataclass
class ComprehensionResult:
    summary: str
    raw_output: str  # unprocessed LLM response (same as summary for now)


@dataclass
class TopicResult:
    document_title: str
    topics: list[dict[str, Any]]
    raw_output: dict[str, Any]  # full parsed JSON from LLM


@dataclass
class OutlineResult:
    blocks: list[Block]
    failed_topics: list[str]
    raw_outputs: dict[str, str] = field(default_factory=dict)  # topic_id → raw markdown


# ---------------------------------------------------------------------------
# Pipeline orchestrator
# ---------------------------------------------------------------------------


async def extract_project(
    source_text: str,
    user_focus: str,
    language: str = "en",
    debug: bool = False,
) -> CheatsheetProject:
    client = LLMClient()
    focus = user_focus.strip() or "none"
    lang_instruction = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["en"])
    warnings: list[str] = []

    # Stage 0: comprehension
    comprehension = await _run_comprehension(client, source_text, focus, lang_instruction)
    if debug:
        logger.info("=== Stage 0: Comprehension ===\n%s", comprehension.summary[:2000])
        warnings.append(f"[debug] Stage 0 summary length: {len(comprehension.summary)} chars")

    # Stage 1: topic extraction (uses digest only)
    topic_result = await _run_topic_extraction(
        client, comprehension.summary, focus, lang_instruction
    )
    if debug:
        topic_names = [t["title"] for t in topic_result.topics]
        logger.info("=== Stage 1: Topics ===\n%s", topic_names)
        warnings.append(f"[debug] Stage 1 topics: {topic_names}")

    if len(topic_result.topics) > MAX_TOPICS:
        warnings.append(
            f"Trimmed topic extraction from {len(topic_result.topics)} to {MAX_TOPICS} topics."
        )

    topics = topic_result.topics[:MAX_TOPICS]

    # Stage 2: outline extraction per topic (digest + raw fallback)
    stage2_source = (
        "## STRUCTURED DIGEST (primary — treat as authoritative)\n\n"
        + comprehension.summary
        + "\n\n## RAW SOURCE (reference — use for details not in the digest)\n\n"
        + source_text
    )
    outline_result = await _run_outline_extraction(
        client, stage2_source, focus, topics, lang_instruction
    )
    if debug:
        block_count = len(outline_result.blocks)
        logger.info("=== Stage 2: Outlines === %d blocks, %d failed", block_count, len(outline_result.failed_topics))
        warnings.append(f"[debug] Stage 2: {block_count} blocks, failed: {outline_result.failed_topics}")

    if outline_result.failed_topics:
        warnings.append(
            "Failed to extract some topics: "
            + ", ".join(outline_result.failed_topics[:4])
            + ("." if len(outline_result.failed_topics) <= 4 else ", and more.")
        )

    # Assemble
    return _assemble_project(
        topic_result.document_title, topics, outline_result.blocks, warnings
    )


# ---------------------------------------------------------------------------
# Stage 0: comprehension — evidence inventory
# ---------------------------------------------------------------------------


async def _run_comprehension(
    client: LLMClient, source_text: str, user_focus: str, lang_instruction: str
) -> ComprehensionResult:
    raw = await asyncio.to_thread(_comprehend, client, source_text, user_focus, lang_instruction)
    return ComprehensionResult(summary=raw, raw_output=raw)


def _comprehend(
    client: LLMClient, source_text: str, user_focus: str, lang_instruction: str
) -> str:
    system = load_prompt("system") + f"\n\n## Language\n\n{lang_instruction}"
    template = load_prompt("comprehend")
    user = template.replace("{user_focus}", user_focus).replace(
        "{source_text}", source_text
    )
    return client.complete(system, user)


# ---------------------------------------------------------------------------
# Stage 1: topic extraction
# ---------------------------------------------------------------------------


async def _run_topic_extraction(
    client: LLMClient, source_text: str, user_focus: str, lang_instruction: str
) -> TopicResult:
    raw_json = await asyncio.to_thread(
        _extract_topics, client, source_text, user_focus, lang_instruction
    )
    document_title = raw_json.get("document_title") or "Untitled cheatsheet"
    raw_topics = raw_json.get("topics") or []
    if not raw_topics:
        raise ValueError("LLM returned no topics — source may be too short or unparseable")

    topics = [_normalize_topic(t, idx) for idx, t in enumerate(raw_topics)]
    return TopicResult(document_title=document_title, topics=topics, raw_output=raw_json)


def _extract_topics(
    client: LLMClient, source_text: str, user_focus: str, lang_instruction: str
) -> dict[str, Any]:
    system = load_prompt("system") + f"\n\n## Language\n\n{lang_instruction}"
    template = load_prompt("extract_topics")
    user = template.replace("{user_focus}", user_focus).replace(
        "{source_text}", source_text
    )
    return client.complete_json(system, user)


# ---------------------------------------------------------------------------
# Stage 2: outline extraction per topic (parallel)
# ---------------------------------------------------------------------------


async def _run_outline_extraction(
    client: LLMClient,
    source_text: str,
    user_focus: str,
    topics: list[dict[str, Any]],
    lang_instruction: str,
) -> OutlineResult:
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(topics))) as pool:
        futures = [
            loop.run_in_executor(
                pool,
                _extract_outline_for_topic,
                client,
                source_text,
                user_focus,
                t,
                topics,
                lang_instruction,
            )
            for t in topics
        ]
        results = await asyncio.gather(*futures, return_exceptions=True)

    all_blocks: list[Block] = []
    failed_topics: list[str] = []
    raw_outputs: dict[str, str] = {}

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
            raw_outputs[topic["id"]] = f"ERROR: {result}"
            continue

        raw_blocks, raw_md = result
        raw_outputs[topic["id"]] = raw_md
        for raw_block in raw_blocks:
            block = _normalize_outline_block(raw_block)
            if block is not None:
                all_blocks.append(block)

    if not any(b.type != BlockType.topic for b in all_blocks):
        raise RuntimeError("All topic outline extraction passes failed.")

    return OutlineResult(blocks=all_blocks, failed_topics=failed_topics, raw_outputs=raw_outputs)


def _extract_outline_for_topic(
    client: LLMClient,
    source_text: str,
    user_focus: str,
    topic: dict[str, Any],
    all_topics: list[dict[str, Any]],
    lang_instruction: str,
) -> tuple[list[dict[str, Any]], str]:
    system = load_prompt("system") + f"\n\n## Language\n\n{lang_instruction}"
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
    parsed = parse_outline(raw_markdown, topic["id"])
    return parsed, raw_markdown


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------


def _assemble_project(
    document_title: str,
    topics: list[dict[str, Any]],
    blocks: list[Block],
    warnings: list[str],
) -> CheatsheetProject:
    content_ids = [b.id for b in blocks if b.type != BlockType.topic]
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
        blocks=blocks,
        pages=[list_page, mindmap_page],
        warnings=warnings,
    )


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
