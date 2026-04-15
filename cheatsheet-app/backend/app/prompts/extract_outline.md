## Task: Extract content blocks as a hierarchical Markdown outline

Read the SOURCE MATERIAL and extract all exam-worthy content for the topic below. Output a **Markdown outline** where heading depth encodes parent-child hierarchy.

## Current topic

- id: `{topic_id}`
- title: `{topic_title}`
- topic importance: `{topic_importance}`
- anchor terms: `{topic_anchor_terms}`

## Sibling topics

These topics are handled elsewhere. Do not repeat their core content unless a very short contrast is essential.

{other_topics}

## User focus

{user_focus}

## Output format

Write a plain Markdown document. Heading levels encode hierarchy:

- `##` = main blocks directly under this topic
- `###` = sub-blocks (children of the `##` above them)
- `####` = sub-sub-blocks (children of the `###` above them)
- Deeper nesting (`#####` etc.) is allowed when the content naturally warrants it

Each heading MUST be immediately followed by a metadata line in blockquote format:

```
> type | importance | compressibility
```

- `type`: one of `definition`, `formula`, `comparison`, `pitfall`, `procedure`, `exam_tip`, `example`
- `importance`: 0.0-1.0
- `compressibility`: `high`, `medium`, or `low`
- Append `| must_keep` if the block is critical

After the metadata line, write the content as a single **main paragraph** -- terse but complete (the full version).

For `formula` type blocks, also add a line:
- `**latex:**` -- raw LaTeX body (no `$` delimiters, no `\begin{equation}`)

## Example output

```
## Risk Budget Framework
> definition | 0.95 | low | must_keep
Risk budgeting defines risk tolerance first: target Sharpe, drawdown limits, volatility caps. Anchors portfolio construction.

### Setting Sharpe Targets
> procedure | 0.85 | medium
Steps: (1) Estimate expected return range (2) Set max drawdown (3) Derive target Sharpe from risk/return tradeoff.

### Common Mistakes
> pitfall | 0.80 | high
Don't ignore regime shifts when setting risk budgets. Static budgets break in crisis periods.

#### Crisis Example: 2008
> example | 0.60 | high
In 2008, static risk budgets led to 40%+ drawdowns. Adaptive budgets cut losses to ~20%.
```

## Rules

- **Every heading MUST be followed by a non-empty content paragraph** (after the metadata line). A heading with only a metadata line and no body is forbidden. If you cannot produce at least one concrete sentence of exam-worthy content for a heading, **do not output that heading at all**. Skeleton-only entries are dropped downstream and waste tokens.
- Exception: `formula` blocks may omit the main paragraph **only if** the `**latex:**` line alone fully conveys the content. Prefer including a short explanation anyway.
- Aim for **3-10 blocks** at the `##` level. Each `##` may have 0-5 sub-blocks.
- Encourage **2-3 levels** of nesting where the content naturally supports it. Sub-procedures, sub-definitions, examples under a concept -- these belong as `###` children. Don't force nesting where a flat list is natural.
- Stay tightly inside the current topic boundary. If a fact belongs more naturally to a sibling topic, omit it here.
- Prefer blocks with concrete exam value: formulas, assumptions, trigger phrases, contrasts, edge cases, variable meanings, or step sequences.
- Avoid generic filler such as "X is important", "used in many applications", "measures performance", or textbook intros that add no exam leverage.
- If the source has thin coverage for this topic, return fewer blocks rather than padding with vague summaries.
- For `formula` blocks, the main paragraph should explain what the expression is for, when it is used, and what the key symbols mean when that information exists in the source.
- For `comparison` blocks, use crisp A vs B language and include the actual tradeoff or discriminating condition.
- For `pitfall` and `exam_tip`, prefer "if you see X, think Y" style cues over broad advice.
- `compressibility`: `low` = formulas, precise definitions, exact values; `medium` = normal prose; `high` = examples, elaborations, context (drop first when space is tight).
- `importance` is local to this topic. Core formulas and definitions = 0.9+; background examples = 0.4-0.6.
- `must_keep`: at most 1-2 blocks per topic. TRUE only for blocks that would make the cheatsheet useless if omitted.
- `latex`: for `formula` type = REQUIRED. For other types = only if an inline formula is worth rendering. Never wrap in delimiters.
- Output **ONLY the Markdown outline**. No commentary, no explanations before or after.

## SOURCE MATERIAL

The source below contains two sections:

1. **STRUCTURED DIGEST** -- authoritative, pre-analyzed. Use this as your primary source for structure, concepts, and content.
2. **RAW EXCERPTS** (optional) -- selected paragraphs from the original material relevant to this topic. Use these for exact wording, precise formulas, thresholds, edge-case details, and variable definitions that the digest may have compressed.

If the digest and excerpts conflict, prefer the digest unless the excerpt contains a clearly more precise source fact (e.g. an exact formula vs. a paraphrase).

{source_text}
