import type { Block } from '../types/block'

export function filterByImportance(blocks: Block[], threshold: number): Block[] {
  if (threshold <= 0) return blocks

  const byId = new Map(blocks.map((b) => [b.id, b]))

  function passes(b: Block): boolean {
    return b.must_keep || b.importance >= threshold
  }

  const keep = new Set<string>()
  for (const block of blocks) {
    let ok = true
    let cur: Block | undefined = block
    const seen = new Set<string>()
    while (cur) {
      if (seen.has(cur.id)) break
      seen.add(cur.id)
      if (!passes(cur)) {
        ok = false
        break
      }
      if (!cur.parent_id || !byId.has(cur.parent_id)) break
      cur = byId.get(cur.parent_id)
    }
    if (ok) keep.add(block.id)
  }

  return blocks.filter((b) => keep.has(b.id))
}
