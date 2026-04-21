"""Unit tests for app.services.outline_parser.

Covers the contract the 4-stage pipeline depends on:
  - heading → block mapping with parent_id chain from ## through ######
  - metadata line (type | importance | compressibility | must_keep) in any order
  - content body vs **latex:** separation
  - id slugification + collision-safe uniquification
  - warnings surfaced for malformed input (so the pipeline can forward them)
"""

from __future__ import annotations

from app.services.outline_parser import parse_outline


def _titles(blocks):
    return [b["title"] for b in blocks]


def _by_title(blocks, title):
    for b in blocks:
        if b["title"] == title:
            return b
    raise AssertionError(f"block {title!r} not found in {_titles(blocks)}")


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_single_block_parses_heading_meta_body():
    md = """## Binary Search
> definition | 0.9 | low | must_keep

Search a sorted array by halving the interval.
"""
    result = parse_outline(md, topic_id="t_search")

    assert len(result.blocks) == 1
    b = result.blocks[0]
    assert b["title"] == "Binary Search"
    assert b["type"] == "definition"
    assert b["importance"] == 0.9
    assert b["compressibility"] == "low"
    assert b["must_keep"] is True
    assert b["parent_id"] == "t_search"
    assert "Search a sorted array" in b["content"]
    assert b["latex"] is None
    assert result.warnings == []


def test_meta_order_insensitive():
    """Parser must accept metadata parts in any order."""
    md = """## Foo
> 0.3 | high | formula
"""
    result = parse_outline(md, topic_id="t")
    b = result.blocks[0]
    assert b["type"] == "formula"
    assert b["importance"] == 0.3
    assert b["compressibility"] == "high"
    assert b["must_keep"] is False


def test_latex_line_extracted_and_body_stripped():
    md = """## Quadratic
> formula | 0.8 | medium

Solves ax^2 + bx + c = 0.
**latex:** x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}
"""
    result = parse_outline(md, topic_id="t_math")
    b = result.blocks[0]
    assert b["latex"] == "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
    assert "Solves ax^2" in b["content"]
    assert "latex" not in b["content"].lower()


# ---------------------------------------------------------------------------
# Hierarchy
# ---------------------------------------------------------------------------


def test_nested_headings_build_parent_chain():
    md = """## Parent
> definition | 0.5 | medium

Body.

### Child
> example | 0.5 | medium

Body.

#### Grandchild
> example | 0.5 | medium

Body.

### Sibling
> example | 0.5 | medium

Body.
"""
    result = parse_outline(md, topic_id="t_tree")
    blocks = result.blocks

    parent = _by_title(blocks, "Parent")
    child = _by_title(blocks, "Child")
    grand = _by_title(blocks, "Grandchild")
    sibling = _by_title(blocks, "Sibling")

    assert parent["parent_id"] == "t_tree"
    assert child["parent_id"] == parent["id"]
    assert grand["parent_id"] == child["id"]
    assert sibling["parent_id"] == parent["id"]


def test_heading_level_jump_warning():
    """## → #### (skipping ###) should warn but still parse."""
    md = """## Top
> definition | 0.5 | medium

Body.

#### Skipped
> definition | 0.5 | medium

Body.
"""
    result = parse_outline(md, topic_id="t")
    assert len(result.blocks) == 2
    assert any("jumped" in w for w in result.warnings)


# ---------------------------------------------------------------------------
# ID generation
# ---------------------------------------------------------------------------


def test_duplicate_titles_get_unique_ids():
    md = """## Foo
> definition | 0.5 | medium

one.

## Foo
> definition | 0.5 | medium

two.
"""
    result = parse_outline(md, topic_id="t")
    ids = [b["id"] for b in result.blocks]
    assert len(set(ids)) == 2
    assert any(i.endswith("_2") for i in ids)


def test_slugify_strips_punctuation_and_lowercases():
    md = """## Big-O Notation!!! (Complexity)
> definition | 0.5 | medium

Body.
"""
    result = parse_outline(md, topic_id="t")
    bid = result.blocks[0]["id"]
    assert bid == "t_bigo_notation_complexity"


# ---------------------------------------------------------------------------
# Defensive / warning cases
# ---------------------------------------------------------------------------


def test_missing_meta_line_warns_and_uses_defaults():
    md = """## NoMeta

Some body text with no leading metadata.
"""
    result = parse_outline(md, topic_id="t")
    b = result.blocks[0]
    assert b["type"] == "definition"
    assert b["importance"] == 0.5
    assert b["compressibility"] == "medium"
    assert b["must_keep"] is False
    assert any("no metadata" in w for w in result.warnings)


def test_meta_without_type_warns_and_defaults_to_definition():
    md = """## Bar
> 0.7 | high

body.
"""
    result = parse_outline(md, topic_id="t")
    assert result.blocks[0]["type"] == "definition"
    assert any("no valid block type" in w for w in result.warnings)


def test_formula_without_latex_warns():
    md = """## Only Formula
> formula | 0.8 | medium

Words only — no equation.
"""
    result = parse_outline(md, topic_id="t")
    assert any("formula block has no" in w for w in result.warnings)


def test_importance_out_of_range_is_clamped():
    md = """## HotTake
> definition | 1.5 | low

Body.
"""
    result = parse_outline(md, topic_id="t")
    assert result.blocks[0]["importance"] == 1.0
    assert any("out of [0,1]" in w for w in result.warnings)


def test_unrecognized_meta_parts_warn():
    md = """## Weird
> definition | 0.5 | medium | gibberish_token

Body.
"""
    result = parse_outline(md, topic_id="t")
    assert any("unrecognized metadata" in w for w in result.warnings)


def test_empty_body_warns():
    md = """## EmptyBody
> definition | 0.5 | medium
"""
    result = parse_outline(md, topic_id="t")
    assert any("empty content body" in w for w in result.warnings)


def test_empty_outline_warns_zero_blocks():
    result = parse_outline("", topic_id="t_empty")
    assert result.blocks == []
    assert any("0 blocks" in w for w in result.warnings)


def test_code_fence_wrapper_is_stripped():
    """LLM sometimes wraps output in ```markdown blocks; parser must peel it."""
    md = """```markdown
## Foo
> definition | 0.5 | medium

Body.
```"""
    result = parse_outline(md, topic_id="t")
    assert len(result.blocks) == 1
    assert result.blocks[0]["title"] == "Foo"
