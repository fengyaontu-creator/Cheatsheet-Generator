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

/**
 * Enhance mindmap atom keepWithNext flags so entire subtrees that fit on a
 * single page stay together. Atoms are emitted in DFS pre-order, so a node's
 * subtree is a contiguous slice [i, i + subtreeSize). Subtrees too tall to
 * fit fall back to the per-atom flag from flattenTreeToAtoms (which only
 * binds a parent to its first child), and the paginator force-fits from there.
 */
export function computeSubtreeKeepWithNext(
  atoms: MindmapAtom[],
  heights: number[],
  margins: number[],
  capacity: number,
): boolean[] {
  const kwn = atoms.map((a) => a.keepWithNext)
  if (atoms.length === 0) return kwn

  // Mirror findBestPartition's segment-height formula: trailing margin of the
  // last item doesn't occupy vertical space at the column/page bottom.
  const prefix: number[] = [0]
  for (const h of heights) prefix.push(prefix[prefix.length - 1] + h)

  const sizeCache = new Map<string, number>()
  function subtreeAtomCount(node: TreeNode): number {
    const cached = sizeCache.get(node.id)
    if (cached !== undefined) return cached
    let n = 1
    for (const child of node.children) n += subtreeAtomCount(child)
    sizeCache.set(node.id, n)
    return n
  }

  for (let i = 0; i < atoms.length; i++) {
    const size = subtreeAtomCount(atoms[i].node)
    if (size <= 1) continue
    const end = i + size
    if (end > atoms.length) continue
    const subtreeHeight = prefix[end] - prefix[i] - margins[end - 1]
    if (subtreeHeight <= capacity) {
      for (let j = i; j < end - 1; j++) kwn[j] = true
    }
  }

  return kwn
}
