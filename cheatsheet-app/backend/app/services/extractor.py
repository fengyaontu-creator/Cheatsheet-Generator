import asyncio
import hashlib
import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
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
from app.services.outline_parser import ParseResult, parse_outline

logger = logging.getLogger(__name__)

VALID_BLOCK_TYPES = {bt.value for bt in BlockType if bt.value != "topic"}
VALID_COMPRESSIBILITY = {c.value for c in Compressibility}
MAX_TOPICS = 12
MAX_WORKERS = 4
EXCERPT_MAX_CHARS = 5000
EXCERPT_MAX_CHARS_RETRY = 10000
TITLE_WEIGHT = 3
ANCHOR_WEIGHT = 1
MULTI_HIT_BONUS = 2  # bonus when 3+ distinct terms match
CACHE_DIR = Path(__file__).resolve().parents[2] / ".cache" / "extractor"

LANGUAGE_INSTRUCTIONS = {
    "en": "Output all content strictly in English.",
    "zh": "Output all content strictly in Simplified Chinese (zh-CN).",
    "mixed": (
        "Output block titles and key terms in English. "
        "Output explanations, annotations, and definitions in Simplified Chinese. "
        "For important English terms, append the Chinese translation in parentheses. "
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
    parser_warnings: list[str] = field(default_factory=list)
    raw_outputs: dict[str, str] = field(default_factory=dict)  # topic_id -> raw markdown


@dataclass(frozen=True)
class StageModels:
    comprehend: str
    topics: str
    outlines: str
    compress: str


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
    stage_models = _resolve_stage_models(client.default_model)
    warnings: list[str] = []

    # Stage 0: comprehension
    comprehension = await _run_comprehension(
        client, source_text, focus, lang_instruction, stage_models.comprehend
    )
    if debug:
        logger.info("=== Stage 0: Comprehension ===\n%s", comprehension.summary[:2000])
        warnings.append(f"[debug] Stage 0 summary length: {len(comprehension.summary)} chars")
        warnings.append(f"[debug] Stage 0 model: {stage_models.comprehend}")

    # Stage 1: topic extraction (uses digest only)
    topic_result = await _run_topic_extraction(
        client, comprehension.summary, focus, lang_instruction, stage_models.topics
    )
    if debug:
        topic_names = [t["title"] for t in topic_result.topics]
        logger.info("=== Stage 1: Topics ===\n%s", topic_names)
        warnings.append(f"[debug] Stage 1 topics: {topic_names}")
        warnings.append(f"[debug] Stage 1 model: {stage_models.topics}")

    if len(topic_result.topics) > MAX_TOPICS:
        warnings.append(
            f"Trimmed topic extraction from {len(topic_result.topics)} to {MAX_TOPICS} topics."
        )

    topics = topic_result.topics[:MAX_TOPICS]

    # Stage 2: outline extraction per topic (digest + per-topic raw excerpts)
    outline_result = await _run_outline_extraction(
        client,
        comprehension.summary,
        source_text,
        focus,
        topics,
        lang_instruction,
        stage_models.outlines,
    )
    if debug:
        block_count = len(outline_result.blocks)
        logger.info("=== Stage 2: Outlines === %d blocks, %d failed", block_count, len(outline_result.failed_topics))
        warnings.append(f"[debug] Stage 2: {block_count} blocks, failed: {outline_result.failed_topics}")
        warnings.append(f"[debug] Stage 2 model: {stage_models.outlines}")

    # Stage 3: density compression
    blocks = await _run_compression(
        client,
        outline_result.blocks,
        topics,
        focus,
        lang_instruction,
        stage_models.compress,
    )
    if debug:
        warnings.append(f"[debug] Stage 3 model: {stage_models.compress}")

    if outline_result.failed_topics:
        warnings.append(
            "Failed to extract some topics: "
            + ", ".join(outline_result.failed_topics[:4])
            + ("." if len(outline_result.failed_topics) <= 4 else ", and more.")
        )

    # Bubble parser warnings (always -- these indicate prompt/format issues)
    if outline_result.parser_warnings:
        warnings.extend(outline_result.parser_warnings)

    # Assemble
    return _assemble_project(
        topic_result.document_title, topics, blocks, warnings
    )


# ---------------------------------------------------------------------------
# Stage 0: comprehension -- evidence inventory
# ---------------------------------------------------------------------------


async def _run_comprehension(
    client: LLMClient,
    source_text: str,
    user_focus: str,
    lang_instruction: str,
    model: str,
) -> ComprehensionResult:
    cache_key = _make_stage_cache_key(
        "stage0_comprehend",
        {
            "source_text": source_text,
            "user_focus": user_focus,
            "lang_instruction": lang_instruction,
            "model": model,
            "system_prompt": load_prompt("system"),
            "prompt": load_prompt("comprehend"),
        },
    )
    cached = _load_stage_cache("stage0", cache_key)
    if cached is not None:
        return ComprehensionResult(
            summary=str(cached.get("summary") or ""),
            raw_output=str(cached.get("raw_output") or cached.get("summary") or ""),
        )

    raw = await asyncio.to_thread(
        _comprehend, client, source_text, user_focus, lang_instruction, model
    )
    result = ComprehensionResult(summary=raw, raw_output=raw)
    _save_stage_cache(
        "stage0",
        cache_key,
        {"summary": result.summary, "raw_output": result.raw_output},
    )
    return result


def _comprehend(
    client: LLMClient,
    source_text: str,
    user_focus: str,
    lang_instruction: str,
    model: str,
) -> str:
    system = load_prompt("system") + f"\n\n## Language\n\n{lang_instruction}"
    template = load_prompt("comprehend")
    user = template.replace("{user_focus}", user_focus).replace(
        "{source_text}", source_text
    )
    return client.complete(system, user, model=model)


# ---------------------------------------------------------------------------
# Stage 1: topic extraction
# ---------------------------------------------------------------------------


async def _run_topic_extraction(
    client: LLMClient,
    source_text: str,
    user_focus: str,
    lang_instruction: str,
    model: str,
) -> TopicResult:
    cache_key = _make_stage_cache_key(
        "stage1_topics",
        {
            "source_text": source_text,
            "user_focus": user_focus,
            "lang_instruction": lang_instruction,
            "model": model,
            "system_prompt": load_prompt("system"),
            "prompt": load_prompt("extract_topics"),
        },
    )
    cached = _load_stage_cache("stage1", cache_key)
    if cached is not None:
        raw_output = cached.get("raw_output") or {}
        document_title = str(
            cached.get("document_title")
            or raw_output.get("document_title")
            or "Untitled cheatsheet"
        )
        topics = [_normalize_topic(t, idx) for idx, t in enumerate(cached.get("topics") or [])]
        if topics:
            return TopicResult(
                document_title=document_title,
                topics=topics,
                raw_output=raw_output,
            )

    raw_json = await asyncio.to_thread(
        _extract_topics, client, source_text, user_focus, lang_instruction, model
    )
    document_title = raw_json.get("document_title") or "Untitled cheatsheet"
    raw_topics = raw_json.get("topics") or []
    if not raw_topics:
        raise ValueError("LLM returned no topics -- source may be too short or unparseable")

    topics = [_normalize_topic(t, idx) for idx, t in enumerate(raw_topics)]
    result = TopicResult(document_title=document_title, topics=topics, raw_output=raw_json)
    if result.topics:
        _save_stage_cache(
            "stage1",
            cache_key,
            {
                "document_title": result.document_title,
                "topics": result.topics,
                "raw_output": result.raw_output,
            },
        )
    return result


def _extract_topics(
    client: LLMClient,
    source_text: str,
    user_focus: str,
    lang_instruction: str,
    model: str,
) -> dict[str, Any]:
    system = load_prompt("system") + f"\n\n## Language\n\n{lang_instruction}"
    template = load_prompt("extract_topics")
    user = template.replace("{user_focus}", user_focus).replace(
        "{source_text}", source_text
    )
    return client.complete_json(system, user, model=model)


# ---------------------------------------------------------------------------
# Stage 2: outline extraction per topic (parallel)
# ---------------------------------------------------------------------------


async def _run_outline_extraction(
    client: LLMClient,
    summary: str,
    raw_source: str,
    user_focus: str,
    topics: list[dict[str, Any]],
    lang_instruction: str,
    model: str,
) -> OutlineResult:
    # Build per-topic source: full digest + topic-specific raw excerpts
    topic_sources: dict[str, str] = {}
    for t in topics:
        search_terms = [t["title"]] + (t.get("anchor_terms") or [])
        excerpts = _extract_relevant_excerpts(raw_source, search_terms, EXCERPT_MAX_CHARS)
        topic_sources[t["id"]] = _build_topic_source(summary, excerpts)

    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(topics))) as pool:
        futures = [
            loop.run_in_executor(
                pool,
                _extract_outline_for_topic,
                client,
                topic_sources[t["id"]],
                user_focus,
                t,
                topics,
                lang_instruction,
                model,
            )
            for t in topics
        ]
        results = await asyncio.gather(*futures, return_exceptions=True)

    all_blocks: list[Block] = []
    failed_topics: list[str] = []
    parser_warnings: list[str] = []
    raw_outputs: dict[str, str] = {}
    retry_topics: list[dict[str, Any]] = []

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

        parse_result, raw_md = result
        raw_outputs[topic["id"]] = raw_md
        parser_warnings.extend(parse_result.warnings)

        content_blocks = [
            _normalize_outline_block(rb) for rb in parse_result.blocks
        ]
        content_blocks = [b for b in content_blocks if b is not None]

        if not content_blocks:
            # Zero blocks -- queue for retry with more excerpts
            retry_topics.append(topic)
            parser_warnings.append(
                f"topic '{topic['title']}': 0 blocks produced, retrying with expanded excerpts"
            )
        else:
            all_blocks.extend(content_blocks)

    # Retry zero-block topics with expanded excerpt limit
    if retry_topics:
        retry_sources: dict[str, str] = {}
        for t in retry_topics:
            search_terms = [t["title"]] + (t.get("anchor_terms") or [])
            excerpts = _extract_relevant_excerpts(
                raw_source, search_terms, EXCERPT_MAX_CHARS_RETRY
            )
            retry_sources[t["id"]] = _build_topic_source(summary, excerpts)

        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(retry_topics))) as pool:
            retry_futures = [
                loop.run_in_executor(
                    pool,
                    _extract_outline_for_topic,
                    client,
                    retry_sources[t["id"]],
                    user_focus,
                    t,
                    topics,
                    lang_instruction,
                    model,
                )
                for t in retry_topics
            ]
            retry_results = await asyncio.gather(*retry_futures, return_exceptions=True)

        for topic, result in zip(retry_topics, retry_results):
            if isinstance(result, Exception):
                failed_topics.append(topic["title"])
                raw_outputs[topic["id"]] = f"RETRY ERROR: {result}"
                continue

            parse_result, raw_md = result
            raw_outputs[topic["id"]] = f"(retry) {raw_md}"
            parser_warnings.extend(parse_result.warnings)

            retry_blocks = [
                _normalize_outline_block(rb) for rb in parse_result.blocks
            ]
            retry_blocks = [b for b in retry_blocks if b is not None]

            if retry_blocks:
                all_blocks.extend(retry_blocks)
            else:
                failed_topics.append(topic["title"])
                parser_warnings.append(
                    f"topic '{topic['title']}': still 0 blocks after retry, marked as failed"
                )

    if not any(b.type != BlockType.topic for b in all_blocks):
        raise RuntimeError("All topic outline extraction passes failed.")

    return OutlineResult(
        blocks=all_blocks,
        failed_topics=failed_topics,
        parser_warnings=parser_warnings,
        raw_outputs=raw_outputs,
    )


def _extract_relevant_excerpts(
    source_text: str, search_terms: list[str], max_chars: int
) -> str:
    """Score paragraphs by relevance to search_terms and return the top ones."""
    paragraphs = [p.strip() for p in re.split(r"\n\n+", source_text) if p.strip()]
    if not paragraphs:
        return ""

    # Build lowered search terms for matching
    terms_lower = [t.lower() for t in search_terms if t]
    title_lower = terms_lower[0] if terms_lower else ""
    anchor_lower = terms_lower[1:] if len(terms_lower) > 1 else []

    scored: list[tuple[float, int, str]] = []  # (score, original_idx, text)
    for idx, para in enumerate(paragraphs):
        para_lower = para.lower()
        score = 0.0

        # Title match: high weight
        if title_lower and title_lower in para_lower:
            score += TITLE_WEIGHT

        # Anchor term matches: count distinct hits
        hits = 0
        for term in anchor_lower:
            if term in para_lower:
                score += ANCHOR_WEIGHT
                hits += 1

        # Multi-hit bonus
        if hits >= 3:
            score += MULTI_HIT_BONUS

        if score > 0:
            scored.append((score, idx, para))

    scored.sort(key=lambda x: (-x[0], x[1]))

    # Take top paragraphs up to max_chars, expanding short ones with neighbors
    selected_indices: set[int] = set()
    total = 0
    for _score, idx, para in scored:
        if total >= max_chars:
            break
        if idx in selected_indices:
            continue

        selected_indices.add(idx)
        total += len(para)

        # If paragraph is short (<150 chars), grab adjacent for context
        if len(para) < 150:
            for neighbor in (idx - 1, idx + 1):
                if 0 <= neighbor < len(paragraphs) and neighbor not in selected_indices:
                    neighbor_text = paragraphs[neighbor]
                    if total + len(neighbor_text) <= max_chars:
                        selected_indices.add(neighbor)
                        total += len(neighbor_text)

    if not selected_indices:
        return ""

    # Return in original document order
    return "\n\n".join(
        paragraphs[i] for i in sorted(selected_indices)
    )


def _build_topic_source(summary: str, excerpts: str) -> str:
    """Compose the source text for a single topic's outline extraction."""
    parts = [
        "## STRUCTURED DIGEST (authoritative)\n",
        summary,
    ]
    if excerpts:
        parts.append("\n\n## RAW EXCERPTS (reference for exact wording, formulas, thresholds)\n")
        parts.append(excerpts)
    return "\n".join(parts)


def _extract_outline_for_topic(
    client: LLMClient,
    source_text: str,
    user_focus: str,
    topic: dict[str, Any],
    all_topics: list[dict[str, Any]],
    lang_instruction: str,
    model: str,
) -> tuple[ParseResult, str]:
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
    raw_markdown = client.complete(system, user, model=model)
    result = parse_outline(raw_markdown, topic["id"])
    return result, raw_markdown


async def _run_compression(
    client: LLMClient,
    blocks: list[Block],
    topics: list[dict[str, Any]],
    user_focus: str,
    lang_instruction: str,
    model: str,
) -> list[Block]:
    topic_ids = {topic["id"] for topic in topics}
    block_by_id = {block.id: block for block in blocks}
    blocks_by_topic: dict[str, list[Block]] = {topic["id"]: [] for topic in topics}

    for block in blocks:
        if block.type == BlockType.topic:
            continue
        topic_id = _find_topic_id_for_block(block, block_by_id, topic_ids)
        if topic_id is not None:
            blocks_by_topic[topic_id].append(block)

    non_empty_groups = [(topic_id, items) for topic_id, items in blocks_by_topic.items() if items]
    if not non_empty_groups:
        return blocks

    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(non_empty_groups))) as pool:
        futures = [
            loop.run_in_executor(
                pool,
                _compress_topic_blocks,
                client,
                topic_id,
                items,
                user_focus,
                lang_instruction,
                model,
            )
            for topic_id, items in non_empty_groups
        ]
        results = await asyncio.gather(*futures, return_exceptions=True)

    for (_topic_id, items), result in zip(non_empty_groups, results):
        if isinstance(result, Exception):
            logger.warning("Stage 3 compression failed: %s", result)
            for block in items:
                block.content_short = None
                block.content_ultra_short = None
            continue

        compressed_by_id = {entry["id"]: entry for entry in result}
        for block in items:
            compressed = compressed_by_id.get(block.id)
            if compressed is None:
                block.content_short = None
                block.content_ultra_short = None
                continue
            block.content_short = _opt_str(compressed.get("content_short"))
            block.content_ultra_short = _opt_str(compressed.get("content_ultra_short"))

    return blocks


def _compress_topic_blocks(
    client: LLMClient,
    topic_id: str,
    blocks: list[Block],
    user_focus: str,
    lang_instruction: str,
    model: str,
) -> list[dict[str, str]]:
    system = load_prompt("system") + f"\n\n## Language\n\n{lang_instruction}"
    template = load_prompt("compress")
    block_payload = [
        {
            "id": block.id,
            "title": block.title,
            "type": block.type.value,
            "content": block.content,
            "latex": block.latex,
        }
        for block in blocks
    ]
    user = (
        template.replace("{user_focus}", user_focus).replace(
            "{blocks_json}", json.dumps(block_payload, ensure_ascii=False, indent=2)
        )
    )
    result = client.complete_json(system, user, model=model)
    raw_blocks = result.get("blocks") or []
    if not isinstance(raw_blocks, list):
        raise ValueError(f"Compression stage returned invalid block list for topic {topic_id}")
    return [
        {
            "id": str(item.get("id") or "").strip(),
            "content_short": str(item.get("content_short") or "").strip(),
            "content_ultra_short": str(item.get("content_ultra_short") or "").strip(),
        }
        for item in raw_blocks
        if isinstance(item, dict) and str(item.get("id") or "").strip()
    ]


def _resolve_stage_models(default_model: str) -> StageModels:
    return StageModels(
        comprehend=os.getenv("OPENROUTER_MODEL_STAGE0", default_model),
        topics=os.getenv("OPENROUTER_MODEL_STAGE1", default_model),
        outlines=os.getenv("OPENROUTER_MODEL_STAGE2", default_model),
        compress=os.getenv("OPENROUTER_MODEL_STAGE3", default_model),
    )


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


def _find_topic_id_for_block(
    block: Block, block_by_id: dict[str, Block], topic_ids: set[str]
) -> str | None:
    parent_id = block.parent_id
    visited: set[str] = set()
    while parent_id:
        if parent_id in topic_ids:
            return parent_id
        if parent_id in visited:
            return None
        visited.add(parent_id)
        parent = block_by_id.get(parent_id)
        if parent is None:
            return None
        parent_id = parent.parent_id
    return None


def _make_stage_cache_key(stage: str, payload: dict[str, Any]) -> str:
    blob = json.dumps(
        {"stage": stage, "payload": payload},
        ensure_ascii=False,
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def _load_stage_cache(stage_dir: str, cache_key: str) -> dict[str, Any] | None:
    path = CACHE_DIR / stage_dir / f"{cache_key}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning("Ignoring unreadable cache file: %s", path)
        return None


def _save_stage_cache(stage_dir: str, cache_key: str, payload: dict[str, Any]) -> None:
    path = CACHE_DIR / stage_dir / f"{cache_key}.json"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        logger.warning("Failed to write cache file %s: %s", path, exc)
