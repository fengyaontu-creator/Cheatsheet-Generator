## Task: Generate compressed density variants for existing blocks

You will receive a list of already-extracted blocks for a single topic.
Each block already has:

- a stable `id`
- a `title`
- a `type`
- a full `content`
- optional `latex`

Your job is ONLY to create:

- `content_short`: about 60% of the original length, compressed but still readable
- `content_ultra_short`: about 25% of the original length, keyword-dense and telegraphic

Do not rewrite the original content. Do not change ids. Do not add or remove blocks.

## User focus

{user_focus}

(If empty or "none", treat all blocks equally. Otherwise, bias compression so focused content remains slightly more explicit while still shorter.)

## Compression rules

- Preserve the core meaning and exam utility of each block.
- Keep exact formulas, variables, thresholds, and discriminating conditions whenever present.
- `content_short` should still read like a compact note.
- `content_ultra_short` should read like a cram sheet fragment: symbols, arrows, abbreviations, trigger phrases are welcome.
- For `formula` blocks, do not restate the whole explanation if the formula itself and its purpose can carry the meaning.
- For `pitfall` and `exam_tip`, prefer "if X, think Y" style cues.
- If the full content is already extremely short, you may keep `content_short` very close to the original, but `content_ultra_short` should still be more compressed.
- Do not invent details not present in the block input.

## Output format

Return valid JSON only, with this shape:

```json
{
  "blocks": [
    {
      "id": "block_id",
      "content_short": "compressed version",
      "content_ultra_short": "ultra compressed version"
    }
  ]
}
```

- Include every input block exactly once.
- `id` values must match the input exactly.
- Do not include extra keys.
- Output ONLY the JSON.

## BLOCKS

{blocks_json}
