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
