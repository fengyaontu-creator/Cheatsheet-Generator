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

(If the focus section above is empty or says "none", treat all material as equally weighted. Otherwise, bias your selection and importance scores toward the focused areas.)

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
- `importance`: 0.0–1.0
- `compressibility`: `high`, `medium`, or `low`
- Append `| must_keep` if the block is critical

After the metadata line, write the content in three density versions:

1. The **main paragraph** — terse but complete (the full version)
2. A line starting with `**short:**` — ~60% length, abbreviations ok
3. A line starting with `**ultra:**` — ~25% length, keywords + symbols only

For `formula` type blocks, also add a line:
- `**latex:**` — raw LaTeX body (no `$` delimiters, no `\begin{equation}`)

## Example output

```
## Risk Budget Framework
> definition | 0.95 | low | must_keep
Risk budgeting defines risk tolerance first: target Sharpe, drawdown limits, volatility caps. Anchors portfolio construction.
**short:** Risk budget = tolerance first. Sharpe + drawdown + vol caps.
**ultra:** Risk budget → Sharpe/drawdown/vol

### Setting Sharpe Targets
> procedure | 0.85 | medium
Steps: (1) Estimate expected return range (2) Set max drawdown (3) Derive target Sharpe from risk/return tradeoff.
**short:** Est return → max drawdown → derive Sharpe
**ultra:** return → drawdown → Sharpe

### Common Mistakes
> pitfall | 0.80 | high
Don't ignore regime shifts when setting risk budgets. Static budgets break in crisis periods.
**short:** Don't ignore regime shifts. Static budgets fail in crisis.
**ultra:** ≠static budget; regimes matter

#### Crisis Example: 2008
> example | 0.60 | high
In 2008, static risk budgets led to 40%+ drawdowns. Adaptive budgets cut losses to ~20%.
**short:** 2008: static → 40% loss; adaptive → ~20%.
**ultra:** 2008: static 40% vs adaptive 20%
```

## Rules

- Aim for **3-10 blocks** at the `##` level. Each `##` may have 0-5 sub-blocks.
- Encourage **2-3 levels** of nesting where the content naturally supports it. Sub-procedures, sub-definitions, examples under a concept — these belong as `###` children. Don't force nesting where a flat list is natural.
- Three density versions are **required** for every block.
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

{source_text}
