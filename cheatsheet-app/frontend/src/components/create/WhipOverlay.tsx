import React, { useEffect, useRef, useState } from 'react'
import {
  createChain,
  stepChain,
  DEFAULT_CHAIN_CONFIG,
  type ChainNode,
} from '../../utils/whipPhysics'

interface Props {
  active: boolean
}

const NODE_COUNT = 18
const FADE_MS = 400
// Mouse speed (px/ms) at which velocity-reactive styling hits full intensity.
// A brisk swing is ~2 px/ms; a relaxed move ~0.5.
const PIVOT_SPEED = 2.5

export default function WhipOverlay({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chainRef = useRef<ChainNode[] | null>(null)
  const mouseRef = useRef<{ x: number; y: number }>({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  })
  const rafRef = useRef<number | null>(null)
  const [mounted, setMounted] = useState(active)
  const [opacity, setOpacity] = useState(0)

  // Mount/unmount with a short fade so the whip appearance is smooth and it
  // doesn't pop in mid-frame when the 10-second timer fires.
  useEffect(() => {
    if (active) {
      setMounted(true)
      const id = window.setTimeout(() => setOpacity(1), 16)
      return () => window.clearTimeout(id)
    }
    setOpacity(0)
    const id = window.setTimeout(() => setMounted(false), FADE_MS)
    return () => window.clearTimeout(id)
  }, [active])

  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function onMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }

    resize()
    chainRef.current = createChain(NODE_COUNT, mouseRef.current)

    // Hide system cursor so the whip reads as the pointer itself while active.
    const prevCursor = document.body.style.cursor
    document.body.style.cursor = 'none'

    window.addEventListener('mousemove', onMove)
    window.addEventListener('resize', resize)

    let last = performance.now()
    let intensity = 0
    const lastMouse = { x: mouseRef.current.x, y: mouseRef.current.y }

    function frame(now: number) {
      const dt = Math.max(Math.min(now - last, 32), 1)
      last = now

      const m = mouseRef.current
      const speed = Math.hypot(m.x - lastMouse.x, m.y - lastMouse.y) / dt
      const target = Math.min(speed / PIVOT_SPEED, 1)
      // EMA smoothing: fast rise-up, ~1s decay when mouse stops.
      intensity = intensity * 0.88 + target * 0.12
      lastMouse.x = m.x
      lastMouse.y = m.y

      const nodes = chainRef.current
      if (nodes && ctx && canvas) {
        stepChain(nodes, mouseRef.current, DEFAULT_CHAIN_CONFIG)

        // Clear in CSS-pixel coords so the active dpr transform maps clearRect
        // back to exactly the device-pixel buffer size. Using canvas.width/
        // height here double-applies dpr and causes some browsers to silently
        // skip the clear, leaving trails every frame.
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        drawHandle(ctx, mouseRef.current, nodes[0])
        drawWhip(ctx, nodes, intensity)
      }

      rafRef.current = window.requestAnimationFrame(frame)
    }
    rafRef.current = window.requestAnimationFrame(frame)

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
      document.body.style.cursor = prevCursor
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1001,
        opacity,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    />
  )
}

// Brown leather whip. Solid color (no translucency — the user explicitly
// rejected semi-transparency as looking ghostly), with a short ground-drop
// shadow so the whip reads as a physical object resting above the page.
const WHIP_BASE = [107, 63, 30] as const // #6b3f1e — base leather
const WHIP_BRIGHT = [160, 104, 56] as const // #a06838 — lit leather on fast swings

function mix(a: readonly [number, number, number], b: readonly [number, number, number], t: number) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`
}

function drawWhip(
  ctx: CanvasRenderingContext2D,
  nodes: ChainNode[],
  intensity: number,
) {
  if (nodes.length < 2) return

  // Velocity-reactive: fast swings thicken the whip and lift its color
  // toward the brighter leather tone. Alpha stays at 1 end-to-end.
  const widthMult = 1 + intensity * 0.6
  const leather = mix(WHIP_BASE, WHIP_BRIGHT, intensity)

  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2
  ctx.shadowBlur = 3
  ctx.lineCap = 'round'
  ctx.strokeStyle = leather

  // Thick tapering body, drawn in overlapping segments so the stroke width
  // can shrink smoothly from grip end to tail.
  for (let i = 0; i < nodes.length - 1; i++) {
    const t = i / (nodes.length - 1)
    const width = (9 * (1 - t) + 1.2) * widthMult
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(nodes[i].x, nodes[i].y)
    ctx.lineTo(nodes[i + 1].x, nodes[i + 1].y)
    ctx.stroke()
  }

  const tail = nodes[nodes.length - 1]
  ctx.beginPath()
  ctx.arc(tail.x, tail.y, 5, 0, Math.PI * 2)
  ctx.fillStyle = leather
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

// Rigid grip section — the part the hand is holding. A thick dark line from
// the mouse (pommel end) to nodes[0] (whip attachment), capped with a small
// pommel disc at the cursor and a brass band at the junction with the whip.
function drawHandle(
  ctx: CanvasRenderingContext2D,
  mouse: { x: number; y: number },
  tip: { x: number; y: number },
) {
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 2
  ctx.shadowBlur = 3

  ctx.lineCap = 'round'
  ctx.strokeStyle = '#3a2612'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(mouse.x, mouse.y)
  ctx.lineTo(tip.x, tip.y)
  ctx.stroke()

  // Pommel (cursor end) — larger, darker disc so the grip reads as solid.
  ctx.fillStyle = '#2a1a0c'
  ctx.beginPath()
  ctx.arc(mouse.x, mouse.y, 7, 0, Math.PI * 2)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // Brass ferrule at the handle-to-whip junction: a short perpendicular
  // line across the grip axis. Shadow off so it pops as a metal highlight.
  const dx = tip.x - mouse.x
  const dy = tip.y - mouse.y
  const d = Math.hypot(dx, dy) || 1
  const nx = -dy / d
  const ny = dx / d
  const half = 5
  ctx.strokeStyle = '#b89668'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(tip.x + nx * half, tip.y + ny * half)
  ctx.lineTo(tip.x - nx * half, tip.y - ny * half)
  ctx.stroke()
}
