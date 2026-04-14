"""Parse a hierarchical Markdown outline into flat block dicts with parent_id chains."""

import re
from dataclasses import dataclass, field
from typing import Any

VALID_TYPES = {
    "definition",
    "formula",
    "comparison",
    "pitfall",
    "procedure",
    "exam_tip",
    "example",
}
VALID_COMPRESSIBILITY = {"high", "medium", "low"}

_HEADING_RE = re.compile(r"^(#{2,6})\s+(.+)$")
_META_RE = re.compile(r"^>\s*(.+)$")


@dataclass
class ParseResult:
    blocks: list[dict[str, Any]]
    warnings: list[str] = field(default_factory=list)


def parse_outline(
    markdown: str, topic_id: str
) -> ParseResult:
    """Convert a Markdown outline into a list of block dicts ready for normalisation."""
    text = _strip_fences(markdown)
    lines = text.split("\n")

    blocks: list[dict[str, Any]] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()
    # Stack of (heading_level, block_id) for parent resolution
    parent_stack: list[tuple[int, str]] = []

    current: dict[str, Any] | None = None
    current_title: str = ""
    meta_parsed = False
    content_lines: list[str] = []
    prev_level: int = 0

    def flush() -> None:
        nonlocal current, current_title, meta_parsed, content_lines
        if current is None:
            return
        body, latex = _parse_content_lines(content_lines)
        current["content"] = body or ""
        current["latex"] = latex

        # Warn on formula blocks without latex
        if current.get("type") == "formula" and not latex:
            warnings.append(f"block '{current_title}': formula block has no **latex:** field")
        # Warn on empty body
        if not body:
            warnings.append(f"block '{current_title}': empty content body")

        blocks.append(current)
        current = None
        current_title = ""
        meta_parsed = False
        content_lines = []

    for line in lines:
        heading_m = _HEADING_RE.match(line)
        if heading_m:
            flush()
            level = len(heading_m.group(1))  # ## = 2, ### = 3, etc.
            title = heading_m.group(2).strip()
            block_id = _make_id(topic_id, title, seen_ids)

            # Warn on heading level jumps (e.g. ## → #### skipping ###)
            if prev_level > 0 and level > prev_level + 1:
                warnings.append(
                    f"block '{title}': heading jumped from {'#' * prev_level} to {'#' * level} "
                    f"(skipped {'#' * (prev_level + 1)})"
                )
            prev_level = level

            # Find parent: pop until we find a shallower level
            while parent_stack and parent_stack[-1][0] >= level:
                parent_stack.pop()
            parent_id = parent_stack[-1][1] if parent_stack else topic_id
            parent_stack.append((level, block_id))

            current = {
                "id": block_id,
                "title": title,
                "parent_id": parent_id,
                "type": "definition",
                "importance": 0.5,
                "compressibility": "medium",
                "must_keep": False,
            }
            current_title = title
            meta_parsed = False
            content_lines = []
            continue

        if current is not None:
            # Try metadata line (first > line after heading)
            if not meta_parsed:
                meta_m = _META_RE.match(line)
                if meta_m:
                    meta, meta_warnings = _parse_meta(meta_m.group(1), current_title)
                    current.update(meta)
                    warnings.extend(meta_warnings)
                    meta_parsed = True
                    continue
                # A non-empty non-meta line means no metadata provided
                if line.strip():
                    warnings.append(
                        f"block '{current_title}': no metadata line (expected > type | importance | compressibility)"
                    )
                    meta_parsed = True

            content_lines.append(line)

    flush()

    if not blocks:
        warnings.append(f"topic '{topic_id}': parser produced 0 blocks from outline")

    return ParseResult(blocks=blocks, warnings=warnings)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_meta(text: str, block_title: str) -> tuple[dict[str, Any], list[str]]:
    """Parse 'definition | 0.95 | low | must_keep' into a dict + warnings."""
    parts = [p.strip() for p in text.split("|")]
    result: dict[str, Any] = {}
    warnings: list[str] = []
    unrecognized: list[str] = []

    for part in parts:
        if part in VALID_TYPES:
            result["type"] = part
        elif part in VALID_COMPRESSIBILITY:
            result["compressibility"] = part
        elif part == "must_keep":
            result["must_keep"] = True
        else:
            try:
                val = float(part)
                if 0.0 <= val <= 1.0:
                    result["importance"] = val
                else:
                    warnings.append(
                        f"block '{block_title}': importance {val} out of [0,1] range, clamping"
                    )
                    result["importance"] = max(0.0, min(1.0, val))
            except ValueError:
                unrecognized.append(part)

    if "type" not in result:
        warnings.append(
            f"block '{block_title}': metadata has no valid block type, defaulting to 'definition'"
        )
    if unrecognized:
        warnings.append(
            f"block '{block_title}': unrecognized metadata parts: {unrecognized}"
        )

    return result, warnings


def _parse_content_lines(
    lines: list[str],
) -> tuple[str | None, str | None]:
    """Split accumulated lines into body and optional latex."""
    body_parts: list[str] = []
    latex: str | None = None

    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith("**latex:**"):
            latex = stripped[len("**latex:**") :].strip()
        else:
            body_parts.append(line)

    body = "\n".join(body_parts).strip() or None
    return body, latex


def _slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r"[^a-z0-9\s_]", "", s)
    s = re.sub(r"\s+", "_", s.strip())
    return s[:40] or "block"


def _make_id(topic_id: str, title: str, seen: set[str]) -> str:
    base = f"{topic_id}_{_slugify(title)}"
    if base not in seen:
        seen.add(base)
        return base
    i = 2
    while f"{base}_{i}" in seen:
        i += 1
    unique = f"{base}_{i}"
    seen.add(unique)
    return unique


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return text
