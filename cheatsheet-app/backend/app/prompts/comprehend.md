## Task: Produce a concise evidence digest of the source material

Read the SOURCE MATERIAL below. Extract every exam-relevant idea into a **lightweight digest**. A downstream stage will cluster and classify these into cheatsheet blocks; your job is only to make sure nothing exam-worthy is lost and to preserve precise wording where precision matters (formulas, thresholds, exact conditions).

Prefer a short, dense bullet over a verbose one. This digest is read by another LLM, not a human student, so optimize for information density over readability.

## User focus

{user_focus}

## Output format

Write a Markdown document with the sections below. Treat them as a **guide, not a rigid template** -- each bullet should be as short as possible while preserving what an exam writer would care about. If a section has no relevant content, write `(none)` and move on.

### Overview

2-3 sentences: subject, level, and the 3-5 most critical takeaways.

### Facts & definitions

One bullet per term or principle. Include conditions inline.

- **{term}** -- {definition; include scope/conditions inline when present}

### Formulas & quantitative facts

One bullet per expression, threshold, or numeric fact. LaTeX for math (no `$` delimiters).

- **{name}** -- `{LaTeX}`; {variables + units + when it applies, one short sentence}

### Comparisons & contrasts

One bullet per A-vs-B distinction.

- **{A vs B}** -- {what differs + the discriminating condition}

### Procedures & steps

One bullet per multi-step process.

- **{procedure}** -- {step1 -> step2 -> step3; note decision points inline}

### Pitfalls & edge cases

One bullet per gotcha.

- **{short description}** -- if {trigger}, students assume {wrong}, actually {right}

### Key examples

One bullet per worked example.

- **{name}** -- {setup -> key step -> takeaway, one line}

## Rules

- Be COMPLETE on facts -- every distinct formula, threshold, condition, step, and contrast must be captured somewhere. Omission is the primary risk.
- Be PRECISE on values -- copy exact numbers, variable names, and conditions. Do not paraphrase thresholds (keep `< 0.05` as `< 0.05`, not `roughly 0.05`).
- Each bullet is ONE atomic fact or relationship.
- **Length target: the whole digest should be at most ~1.5x the source length.** If you find yourself expanding the source, compress.
- Do NOT invent information not in the source.
- Do NOT add introductions, conclusions, or meta-commentary about the source.
- Output ONLY the Markdown digest.

## SOURCE MATERIAL

{source_text}
