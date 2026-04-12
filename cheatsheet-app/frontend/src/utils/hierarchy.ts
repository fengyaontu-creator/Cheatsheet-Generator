import type { Block } from '../types/block'

export interface TreeNode {
  id: string
  title: string
  block: Block | null
  children: TreeNode[]
}

export function buildTree(blocks: Block[], rootTitle: string): TreeNode {
  const byId = new Map<string, TreeNode>()
  for (const b of blocks) {
    byId.set(b.id, { id: b.id, title: b.title, block: b, children: [] })
  }

  const root: TreeNode = {
    id: '__root__',
    title: rootTitle,
    block: null,
    children: [],
  }

  for (const b of blocks) {
    const node = byId.get(b.id)!
    if (b.parent_id && byId.has(b.parent_id)) {
      byId.get(b.parent_id)!.children.push(node)
    } else {
      root.children.push(node)
    }
  }

  return root
}

export function collectDescendantIds(blocks: Block[], startId: string): string[] {
  const childrenByParent = new Map<string, string[]>()
  for (const block of blocks) {
    if (!block.parent_id) continue
    const siblings = childrenByParent.get(block.parent_id) ?? []
    siblings.push(block.id)
    childrenByParent.set(block.parent_id, siblings)
  }

  const collected: string[] = []
  const stack = [startId]
  const seen = new Set<string>()

  while (stack.length > 0) {
    const current = stack.pop()!
    if (seen.has(current)) continue
    seen.add(current)
    collected.push(current)
    const children = childrenByParent.get(current) ?? []
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i])
    }
  }

  return collected
}

export function orderBlocksByIds(blocks: Block[], ids: string[]): Block[] {
  const byId = new Map(blocks.map((block) => [block.id, block]))
  const ordered: Block[] = []
  for (const id of ids) {
    const block = byId.get(id)
    if (block) ordered.push(block)
  }
  return ordered
}
