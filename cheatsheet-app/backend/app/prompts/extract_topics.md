## Task: Extract the topic outline

Read the SOURCE MATERIAL below and produce a flat list of high-level topics that the cheatsheet should be organized around. Each topic becomes a section header in the output; actual content blocks will be generated in a second pass.

## User focus

{user_focus}

## Output schema

Return a JSON object with this exact shape:

```json
{
  "document_title": "string -- a short title for the whole cheatsheet, derived from the source",
  "topics": [
    {
      "id": "string -- slug-like, lowercase, underscores, stable",
      "title": "string -- 2-5 words, noun phrase",
      "importance": 0.0,
      "must_keep": false,
      "anchor_terms": ["string"]
    }
  ]
}
```

## Rules

- Aim for **4-8 topics** for a typical source. More than 10 means you're fragmenting; fewer than 3 means you're under-decomposing.
- Topics must be **mutually exclusive** -- no overlap between topics.
- Topics must be **collectively exhaustive** -- every exam-relevant idea in the source should belong to exactly one topic.
- Order topics by **logical teaching order**, not by importance. A reader should be able to learn top-to-bottom.
- `importance` reflects **exam weight**, not topic size. A tiny but critical formula topic can be 0.95; a large but rarely-tested background topic can be 0.4.
- `must_keep` is TRUE only for topics that are the whole reason the cheatsheet exists. Use sparingly -- ideally 1-3 topics.
- `anchor_terms` must be 3-8 short phrases, symbols, or keywords that clearly belong to this topic and help separate it from sibling topics.
- Prefer the MOST discriminative anchors available: exact formula names, symbols, thresholds, operators, acronyms, variable patterns, named corrections, named tests, or precise method names beat generic category words.
- If the source gives an exact threshold/condition/symbol that distinguishes the topic (for example `p < 0.05`, `alpha / m`, `D_KL(q||p)`, `L2`, `||w||_2^2`), include it instead of paraphrasing it away.
- Avoid broad parent-category anchors when a more specific child token exists. For example prefer `L1`, `L2`, `Ridge`, `Lasso` over `regularization`; prefer `Bonferroni correction` over `multiple testing`; prefer `ELBO` over `inference`.
- Do not spend anchor slots repeating the topic title's generic root word when sharper terms already exist. If the title is `Regularization Techniques`, anchors like `regularization` or `techniques` are usually wasted; prefer the child-level discriminators instead.
- Anchor terms should have LOW sibling overlap. Reusing the same generic word across multiple topics is a failure unless the source truly gives no sharper term.
- Do not waste anchor slots on filler words like `methods`, `analysis`, `models`, `concepts`, `applications`, `evaluation`, or `overview` unless those exact words are the real topic boundary in the source.
- Prefer topic boundaries that make extraction easy later. "Evaluation metrics" and "precision vs recall tradeoffs" together is often too broad; "precision/recall/F1" plus "threshold tradeoffs" is cleaner.
- Avoid generic buckets like "misc", "overview", "applications", or "other notes" unless the source itself is organized that way.
- Output **ONLY the JSON object**. No markdown fences, no commentary.

## SOURCE MATERIAL

The source below contains two sections:

1. **STRUCTURED DIGEST** -- authoritative, pre-analyzed. Use this as your primary source for identifying topic boundaries and importance.
2. **RAW EXCERPTS** (optional) -- the opening of the original material, head-truncated and possibly incomplete. Use it only to recover exact tokens the digest may have smoothed away (formula names, symbols, thresholds, acronyms, variable patterns) so `anchor_terms` stay discriminative.

If the digest and excerpts conflict on structure, prefer the digest. If the excerpts have a sharper symbol or threshold for an anchor, prefer the excerpts.

{source_text}
