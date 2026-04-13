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

/* ── Mindmap atoms: fine-grained measurement units ── */

export interface MindmapAtom {
  topicId: string
  topicTitle: string
  nodeId: string
  depth: number
  kind: 'topic-header' | 'node-line'
  keepWithNext: boolean
  node: TreeNode
  title: string
}

/**
 * Flatten topic trees into a linear list of atoms for measurement & pagination.
 * Each node in the tree becomes its own atom, giving the partition algorithm
 * the same fine granularity that list-mode blocks enjoy.
 */
export function flattenTreeToAtoms(topicNodes: TreeNode[]): MindmapAtom[] {
  const atoms: MindmapAtom[] = []
  for (const topic of topicNodes) {
    atoms.push({
      topicId: topic.id,
      topicTitle: topic.title,
      nodeId: topic.id,
      depth: 0,
      kind: 'topic-header',
      keepWithNext: topic.children.length > 0,
      node: topic,
      title: topic.title,
    })
    flattenChildren(atoms, topic.id, topic.title, topic.children, 1)
  }
  return atoms
}

function flattenChildren(
  atoms: MindmapAtom[],
  topicId: string,
  topicTitle: string,
  children: TreeNode[],
  depth: number,
) {
  for (const child of children) {
    atoms.push({
      topicId,
      topicTitle,
      nodeId: child.id,
      depth,
      kind: 'node-line',
      keepWithNext: child.children.length > 0,
      node: child,
      title: child.title,
    })
    if (child.children.length > 0) {
      flattenChildren(atoms, topicId, topicTitle, child.children, depth + 1)
    }
  }
}
