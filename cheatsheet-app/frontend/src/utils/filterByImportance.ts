import type { Block } from '../types/block'

export function filterByImportance(blocks: Block[], threshold: number): Block[] {
  if (threshold <= 0) return blocks

  const byId = new Map(blocks.map((b) => [b.id, b]))
  const keep = new Set<string>()

  for (const block of blocks) {
    if (!block.must_keep && block.importance < threshold) continue

    let cur: Block | undefined = block
    const seen = new Set<string>()
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      keep.add(cur.id)
      if (!cur.parent_id) break
      cur = byId.get(cur.parent_id)
    }
  }

  return blocks.filter((b) => keep.has(b.id))
}
