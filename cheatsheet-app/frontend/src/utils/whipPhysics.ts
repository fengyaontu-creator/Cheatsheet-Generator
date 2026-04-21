export interface ChainNode {
  x: number
  y: number
  px: number // previous x for verlet integration
  py: number
}

export interface ChainConfig {
  segmentLength: number
  gravity: number
  damping: number
  iterations: number
  handleLength: number // rigid grip extending from the mouse before the soft whip
}

export const DEFAULT_CHAIN_CONFIG: ChainConfig = {
  segmentLength: 14,
  gravity: 0.35,
  damping: 0.94,
  iterations: 6,
  handleLength: 40,
}

export function createChain(count: number, origin: { x: number; y: number }): ChainNode[] {
  return Array.from({ length: count }, () => ({
    x: origin.x,
    y: origin.y,
    px: origin.x,
    py: origin.y,
  }))
}

/**
 * One physics step. Mutates nodes in place and returns them.
 *
 * Verlet integration on body nodes + N iterations of segment-length
 * constraints. The head node (index 0) is pinned to an ease-lerped mouse
 * position so small jitters don't translate into a twitchy whip.
 */
export function stepChain(
  nodes: ChainNode[],
  mouse: { x: number; y: number },
  cfg: ChainConfig = DEFAULT_CHAIN_CONFIG,
): ChainNode[] {
  if (nodes.length === 0) return nodes

  // Head is the whip-end of the rigid handle, hard-pinned to the cursor
  // offset by a fixed on-screen "\" angle. The cursor is the *lower* grip
  // end; the whip attaches at the *upper* end of the handle, so we offset
  // up-and-left (negative x, negative y) from the cursor. The grip keeps
  // this angle regardless of how the whip swings — that's what makes it
  // read as a rigid held object rather than an extension of the whip.
  const GRIP_COS = Math.SQRT1_2
  const head = nodes[0]
  head.px = head.x
  head.py = head.y
  head.x = mouse.x - GRIP_COS * cfg.handleLength
  head.y = mouse.y - GRIP_COS * cfg.handleLength

  // Body: verlet step with damping + gravity.
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i]
    const vx = (n.x - n.px) * cfg.damping
    const vy = (n.y - n.py) * cfg.damping
    n.px = n.x
    n.py = n.y
    n.x += vx
    n.y += vy + cfg.gravity
  }

  // Constraint: keep each segment at target length. Head is pinned (index 0
  // only moves its partner). Run several passes for stable chain behaviour.
  for (let pass = 0; pass < cfg.iterations; pass++) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i]
      const b = nodes[i + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 0.0001
      const diff = (dist - cfg.segmentLength) / dist
      if (i === 0) {
        // Anchor the head; only the partner moves.
        b.x -= dx * diff
        b.y -= dy * diff
      } else {
        const half = diff * 0.5
        a.x += dx * half
        a.y += dy * half
        b.x -= dx * half
        b.y -= dy * half
      }
    }
  }

  return nodes
}
