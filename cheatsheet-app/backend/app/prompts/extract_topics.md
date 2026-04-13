## Task: Extract the topic outline

Read the SOURCE MATERIAL below and produce a flat list of high-level topics that the cheatsheet should be organized around. Each topic becomes a section header in the output; actual content blocks will be generated in a second pass.

## User focus

{user_focus}

(If the focus section above is empty or says "none", treat all material as equally weighted. Otherwise, bias your topic selection and importance scores toward the focused areas.)

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
      "anchor_terms": ["string"],
      "rationale": "string -- one sentence, why this topic is on the cheatsheet (used only for your reasoning; will be logged but not shown to user)"
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
- Prefer topic boundaries that make extraction easy later. "Evaluation metrics" and "precision vs recall tradeoffs" together is often too broad; "precision/recall/F1" plus "threshold tradeoffs" is cleaner.
- Avoid generic buckets like "misc", "overview", "applications", or "other notes" unless the source itself is organized that way.
- Output **ONLY the JSON object**. No markdown fences, no commentary.

## SOURCE MATERIAL

The source below may be a structured comprehension digest rather than raw notes. Treat it as authoritative -- it contains all the information you need.

{source_text}
