## Task: Produce an exhaustive evidence inventory of the source material

Read the SOURCE MATERIAL below. Extract every exam-relevant fact into a structured inventory. This inventory will be the PRIMARY input for a cheatsheet generator -- if a fact is missing here, it will likely be lost. Be exhaustive and precise.

## User focus

{user_focus}

(Bias toward focused areas if provided, but do NOT omit unfocused content -- just deprioritize it.)

## Output format

Write a Markdown document with these sections in order. Use the exact item template shown. If a section has no relevant content, write "(none)" and move on.

### Overview

2-3 sentences only. Subject, level, and the 3-5 most critical takeaways. Keep this very short.

### Facts & definitions

For each concept, term, or principle:

- **Name:** {term}
  - Anchor terms: {3-8 keywords/symbols that identify this concept}
  - Related: {other concepts it connects to}
  - Definition: {precise definition -- copy exact wording/conditions from source}
  - Conditions/scope: {when it applies, when it doesn't}

### Formulas & quantitative facts

For each formula, threshold, numeric fact, or precise condition:

- **Name:** {formula/fact name}
  - Anchor terms: {keywords}
  - Related: {parent concept, use cases}
  - Expression: {LaTeX notation}
  - Variables: {what each symbol means, with units if given}
  - When to use: {trigger condition or context}
  - Caveats: {assumptions, edge cases, common misapplications}

### Comparisons & contrasts

For each A-vs-B distinction or tradeoff:

- **Name:** {A vs B}
  - Anchor terms: {keywords for both sides}
  - Dimension: {what is being compared -- speed, accuracy, assumptions, etc.}
  - A: {key properties}
  - B: {key properties}
  - Discriminating condition: {when to pick A over B, or the tradeoff}

### Procedures & steps

For each multi-step process, algorithm, or decision procedure:

- **Name:** {procedure name}
  - Anchor terms: {keywords}
  - Related: {what concept this implements}
  - Steps: {numbered list, exact order}
  - Decision points: {where choices are made and what determines the choice}

### Pitfalls & edge cases

For each common mistake, gotcha, or exception:

- **Name:** {short description}
  - Anchor terms: {keywords}
  - Trigger: {what situation leads to this mistake}
  - Wrong assumption: {what students typically think}
  - Correct behavior: {what actually happens}
  - Cue: {"if you see X, think Y" format}

### Key examples

For each worked example, case study, or illustrative scenario:

- **Name:** {example title}
  - Anchor terms: {keywords}
  - Related: {concept(s) it illustrates}
  - Setup: {problem statement}
  - Key steps/result: {solution outline or punchline}
  - Takeaway: {what it demonstrates}

## Rules

- Be EXHAUSTIVE -- include every distinct fact, formula, condition, step, and contrast. Length is fine. Omission is not.
- Be PRECISE -- copy exact values, thresholds, variable names, conditions. Do not paraphrase numbers or weaken conditions (e.g., "roughly 0.05" when the source says "< 0.05").
- Each item must be ATOMIC -- one concept/formula/comparison per bullet. Do not merge multiple ideas.
- Anchor terms are CRITICAL -- they will be used to cluster items into topics later. Choose terms that uniquely identify this item.
- Do NOT add information not in the source.
- Do NOT write introductory/concluding commentary.
- Output ONLY the Markdown inventory.

## SOURCE MATERIAL

{source_text}
