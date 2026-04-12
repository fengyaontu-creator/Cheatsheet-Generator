"""Parse a hierarchical Markdown outline into flat block dicts with parent_id chains."""

import re
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


def parse_outline(markdown: str, topic_id: str) -> list[dict[str, Any]]:
    """Convert a Markdown outline into a list of block dicts ready for normalisation."""
    text = _strip_fences(markdown)
    lines = text.split("\n")

    blocks: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    # Stack of (heading_level, block_id) for parent resolution
    parent_stack: list[tuple[int, str]] = []

    current: dict[str, Any] | None = None
    meta_parsed = False
    content_lines: list[str] = []

    def flush() -> None:
        nonlocal current, meta_parsed, content_lines
        if current is None:
            return
        body, short, ultra, latex = _parse_content_lines(content_lines)
        current["content"] = body or ""
        current["content_short"] = short
        current["content_ultra_short"] = ultra
        current["latex"] = latex
        blocks.append(current)
        current = None
        meta_parsed = False
        content_lines = []

    for line in lines:
        heading_m = _HEADING_RE.match(line)
        if heading_m:
            flush()
            level = len(heading_m.group(1))  # ## = 2, ### = 3, etc.
            title = heading_m.group(2).strip()
            block_id = _make_id(topic_id, title, seen_ids)

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
            meta_parsed = False
            content_lines = []
            continue

        if current is not None:
            # Try metadata line (first > line after heading)
            if not meta_parsed:
                meta_m = _META_RE.match(line)
                if meta_m:
                    current.update(_parse_meta(meta_m.group(1)))
                    meta_parsed = True
                    continue
                # A non-empty non-meta line means no metadata provided
                if line.strip():
                    meta_parsed = True

            content_lines.append(line)

    flush()
    return blocks


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _parse_meta(text: str) -> dict[str, Any]:
    """Parse 'definition | 0.95 | low | must_keep' into a dict."""
    parts = [p.strip() for p in text.split("|")]
    result: dict[str, Any] = {}
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
            except ValueError:
                pass
    return result


def _parse_content_lines(
    lines: list[str],
) -> tuple[str | None, str | None, str | None, str | None]:
    """Split accumulated lines into body / short / ultra / latex."""
    body_parts: list[str] = []
    short: str | None = None
    ultra: str | None = None
    latex: str | None = None

    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith("**short:**"):
            short = stripped[len("**short:**") :].strip()
        elif stripped.lower().startswith("**ultra:**"):
            ultra = stripped[len("**ultra:**") :].strip()
        elif stripped.lower().startswith("**latex:**"):
            latex = stripped[len("**latex:**") :].strip()
        else:
            body_parts.append(line)

    body = "\n".join(body_parts).strip() or None
    return body, short, ultra, latex


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
