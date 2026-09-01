import {
  type Operation,
  parseNeedle,
  needleKey,
} from './machine'
import type { YarnPath, YarnPoint } from './types'

const COLORS: Record<string, string> = {
  '1': '#ef4444', '2': '#f97316', '3': '#eab308', '4': '#22c55e', '5': '#14b8a6',
  '6': '#06b6d4', '7': '#3b82f6', '8': '#8b5cf6', '9': '#ec4899', '10': '#f43f5e',
}

const NEEDLE_SPACING = 1.1
const BED_GAP = 3.0
const STITCH_HEIGHT = 0.88
const LOOP_W = 0.36
const LOOP_H = 0.48

const bedZ = (bed: string) => (bed === 'f' ? -BED_GAP / 2 : BED_GAP / 2)

type LiveLoop = {
  needle: string
  carrier: string
  points: { x: number; y: number; z: number }[]
  top: { x: number; y: number; z: number }
  bottom: { x: number; y: number; z: number }
  left: { x: number; y: number; z: number }
  right: { x: number; y: number; z: number }
  line: number
  opIndex: number
  courseY: number
  pathId: string
}

function classicLoopLocal(w: number, h: number, samples = 28, tuck = false) {
  const pts: { x: number; y: number; z: number }[] = []
  const ww = tuck ? w * 0.7 : w
  const hh = tuck ? h * 0.62 : h
  const depth = tuck ? 0.04 : 0.1
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const cx = Math.cos(t)
    const sy = Math.sin(t)
    const bottomBias = Math.max(0, -sy)
    const topBias = Math.max(0, sy)
    const widthMod = 1 + 0.22 * bottomBias - 0.08 * topBias
    const lean = topBias * 0.12 * Math.sign(cx || 1)
    const px = cx * ww * widthMod - lean * ww
    const py = sy * hh * (topBias ? 0.95 : 1.08) + (topBias ? 0.05 : -0.12)
    const pz = Math.sin(t) * depth * 0.3 + Math.cos(t) * depth * (cx >= 0 ? 1 : -0.7)
    pts.push({ x: px, y: py, z: pz })
  }
  return pts
}

function placeLoop(
  local: { x: number; y: number; z: number }[],
  cx: number, cy: number, cz: number
) {
  return local.map((p) => ({ x: p.x + cx, y: p.y + cy, z: p.z + cz }))
}

function loopAnchors(pts: { x: number; y: number; z: number }[]) {
  let top = pts[0], bottom = pts[0], left = pts[0], right = pts[0]
  for (const p of pts) {
    if (p.y > top.y) top = p
    if (p.y < bottom.y) bottom = p
    if (p.x < left.x) left = p
    if (p.x > right.x) right = p
  }
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length
  return {
    top: { x: cx, y: top.y, z: cz },
    bottom: { x: cx, y: bottom.y, z: cz },
    left: { x: left.x, y: left.y, z: left.z },
    right: { x: right.x, y: right.y, z: right.z },
  }
}

function interlockThrough(
  prev: LiveLoop,
  nextPts: { x: number; y: number; z: number }[]
) {
  const midY = nextPts.reduce((s, p) => s + p.y, 0) / Math.max(1, nextPts.length)
  return nextPts.map((p) => {
    if (p.y >= midY * 0.92) return { ...p }
    const depthT = Math.min(1, (midY - p.y) / (Math.abs(midY - prev.bottom.y) + 0.25))
    const pull = 0.35 + 0.4 * depthT
    const side = Math.sign(p.x - prev.top.x) || 1
    const spread = 0.06 * depthT * side
    return {
      x: p.x * (1 - pull) + (prev.top.x + spread) * pull,
      y: Math.min(p.y, prev.top.y - 0.1 - 0.08 * depthT),
      z: p.z * (1 - pull * 0.7) + prev.top.z * pull * 0.7,
    }
  })
}

export function linkCarrierPaths(paths: YarnPath[]): YarnPath[] {
  const byCarrier: Record<string, YarnPath[]> = {}
  for (const p of paths) {
    if (p.kind !== 'yarn') continue
    if (!byCarrier[p.carrier]) byCarrier[p.carrier] = []
    byCarrier[p.carrier].push(p)
  }
  const extras: YarnPath[] = []
  for (const [carrier, list] of Object.entries(byCarrier)) {
    list.sort((a, b) => (a.opIndex ?? 0) - (b.opIndex ?? 0))
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i]
      const b = list[i + 1]
      if (a.points.length < 2 || b.points.length < 2) continue
      const last = a.points[Math.floor(a.points.length * 0.65)]
      const first = b.points[Math.floor(b.points.length * 0.35)]
      const dx = first.x - last.x
      const span = Math.hypot(dx, first.y - last.y, first.z - last.z)
      const droop = Math.min(0.35, 0.08 + span * 0.12)
      const mid1 = {
        x: last.x + dx * 0.33,
        y: last.y + (first.y - last.y) * 0.33 - droop * 0.6,
        z: last.z + (first.z - last.z) * 0.33,
      }
      const mid2 = {
        x: last.x + dx * 0.66,
        y: last.y + (first.y - last.y) * 0.66 - droop,
        z: last.z + (first.z - last.z) * 0.66,
      }
      extras.push({
        id: `bridge-${carrier}-${a.opIndex}-${b.opIndex}`,
        carrier,
        color: a.color,
        lines: [a.primaryLine, b.primaryLine],
        kind: 'carrier',
        primaryLine: a.primaryLine,
        opIndex: a.opIndex,
        points: [
          { ...last, carrier, line: a.primaryLine, opIndex: a.opIndex },
          { ...mid1, carrier, line: a.primaryLine, opIndex: a.opIndex },
          { ...mid2, carrier, line: a.primaryLine, opIndex: a.opIndex },
          { ...first, carrier, line: b.primaryLine, opIndex: b.opIndex },
        ],
      })
    }
  }
  return [...paths, ...extras]
}

export function relaxPaths(
  paths: YarnPath[],
  iterations = 56,
  opts: { stiffness?: number; bend?: number; gravity?: number; repulsion?: number; crossRepulsion?: number } = {}
): YarnPath[] {
  const stiffness = opts.stiffness ?? 0.48
  const bend = opts.bend ?? 0.28
  const gravity = opts.gravity ?? 0.012
  const repulsion = opts.repulsion ?? 0.1
  const crossRepulsion = opts.crossRepulsion ?? 0.045
  const restScale = 0.95
  const result = paths.map((p) => ({ ...p, points: p.points.map((pt) => ({ ...pt })) }))
  const restLens: number[][] = result.map((path) => {
    const lens: number[] = []
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i], b = path.points[i + 1]
      lens.push(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * restScale)
    }
    return lens
  })
  const sampleIdx = (n: number) => {
    const out: number[] = []
    for (let i = 0; i < n; i += 3) out.push(i)
    if (n > 0 && out[out.length - 1] !== n - 1) out.push(n - 1)
    return out
  }
  for (let iter = 0; iter < iterations; iter++) {
    for (let pi = 0; pi < result.length; pi++) {
      const path = result[pi]
      if (path.points.length < 3) continue
      const pts = path.points
      const n = pts.length
      const forces = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }))
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i], b = pts[i + 1]
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        const dist = Math.hypot(dx, dy, dz) || 1e-6
        const rest = restLens[pi][i] || dist
        const f = (stiffness * (dist - rest)) / dist
        forces[i].x += dx * f; forces[i].y += dy * f; forces[i].z += dz * f
        forces[i + 1].x -= dx * f; forces[i + 1].y -= dy * f; forces[i + 1].z -= dz * f
      }
      for (let i = 1; i < n - 1; i++) {
        forces[i].x += ((pts[i - 1].x + pts[i + 1].x) * 0.5 - pts[i].x) * bend
        forces[i].y += ((pts[i - 1].y + pts[i + 1].y) * 0.5 - pts[i].y) * bend
        forces[i].z += ((pts[i - 1].z + pts[i + 1].z) * 0.5 - pts[i].z) * bend
      }
      for (let i = 0; i < n; i++) {
        for (let j = i + 4; j < n; j++) {
          const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y, dz = pts[j].z - pts[i].z
          const d2 = dx * dx + dy * dy + dz * dz
          const minD = path.kind === 'carrier' ? 0.12 : 0.2
          if (d2 < minD * minD && d2 > 1e-8) {
            const d = Math.sqrt(d2)
            const push = (repulsion * (minD - d)) / d
            forces[i].x -= dx * push; forces[i].y -= dy * push; forces[i].z -= dz * push
            forces[j].x += dx * push; forces[j].y += dy * push; forces[j].z += dz * push
          }
        }
      }
      if (path.kind === 'yarn' && iter % 2 === 0) {
        const mySamples = sampleIdx(n)
        for (let qi = 0; qi < result.length; qi++) {
          if (qi === pi) continue
          const other = result[qi]
          if (other.kind !== 'yarn' || other.points.length < 3) continue
          if (Math.abs(other.points[0].y - pts[0].y) > STITCH_HEIGHT * 2.5) continue
          for (const i of mySamples) {
            for (const j of sampleIdx(other.points.length)) {
              const a = pts[i], b = other.points[j]
              const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
              const d2 = dx * dx + dy * dy + dz * dz
              if (d2 < 0.28 * 0.28 && d2 > 1e-8) {
                const d = Math.sqrt(d2)
                const push = (crossRepulsion * (0.28 - d)) / d
                forces[i].x -= dx * push; forces[i].y -= dy * push; forces[i].z -= dz * push
              }
            }
          }
        }
      }
      for (let i = 0; i < n; i++) {
        const damp = i === 0 || i === n - 1 ? 0.15 : 0.8
        pts[i].x += forces[i].x * damp
        pts[i].y += forces[i].y * damp - gravity * damp
        pts[i].z += forces[i].z * damp
      }
    }
  }
  return result
}

export function buildGeometry(operations: Operation[], opts?: { courseOffset?: boolean; gauge?: number }): YarnPath[] {
  const gauge = opts?.gauge ?? 1
  const NS = NEEDLE_SPACING * gauge
  const SH = STITCH_HEIGHT * gauge
  const paths: YarnPath[] = []
  let rack = 0, courseY = 0, lastDir: '+' | '-' | null = null, stitchIndex = 0, courseIndex = 0
  const onNeedle: Record<string, LiveLoop[]> = {}
  const localKnit = classicLoopLocal(LOOP_W * gauge, LOOP_H * gauge, 28, false)
  const localTuck = classicLoopLocal(LOOP_W * gauge, LOOP_H * gauge, 18, true)

  for (const operation of operations) {
    const { op, args, line, index: opIndex } = operation
    if (op === 'rack') { rack = parseFloat(args[0]) || 0; continue }

    if (op === 'xfer') {
      const from = parseNeedle(args[0]), to = parseNeedle(args[1])
      if (!from || !to) continue
      const fromKey = needleKey(from.bed, from.n, from.slider)
      const toKey = needleKey(to.bed, to.n, to.slider)
      const stack = onNeedle[fromKey] || []
      if (!stack.length) continue
      const loops = stack.splice(0, stack.length)
      if (!onNeedle[toKey]) onNeedle[toKey] = []
      const toX = to.n * NS + (to.bed === 'b' ? rack * NS : 0)
      const toZ = bedZ(to.bed)
      for (const lp of loops) {
        const fromC = {
          x: lp.points.reduce((s, p) => s + p.x, 0) / lp.points.length,
          y: lp.points.reduce((s, p) => s + p.y, 0) / lp.points.length,
          z: lp.points.reduce((s, p) => s + p.z, 0) / lp.points.length,
        }
        const toC = { x: toX, y: courseY + 0.12 * gauge, z: toZ }
        const xferPts: YarnPoint[] = []
        for (let i = 0; i <= 16; i++) {
          const t = i / 16
          const ease = t * t * (3 - 2 * t)
          xferPts.push({
            x: fromC.x + (toC.x - fromC.x) * ease,
            y: fromC.y + (toC.y - fromC.y) * ease + Math.sin(t * Math.PI) * 1.15 * gauge,
            z: fromC.z + (toC.z - fromC.z) * ease,
            line, opIndex,
          })
        }
        paths.push({
          id: `xfer-${opIndex}-${lp.carrier}`, carrier: 'xfer', color: '#fbbf24',
          lines: [line], kind: 'transfer', primaryLine: line, opIndex, points: xferPts,
        })
        const moved = placeLoop(localKnit, toX, courseY, toZ)
        const anchors = loopAnchors(moved)
        lp.points = moved
        lp.top = anchors.top; lp.bottom = anchors.bottom
        lp.left = anchors.left; lp.right = anchors.right
        lp.needle = toKey
        onNeedle[toKey].push(lp)
      }
      continue
    }

    if (op === 'drop') {
      const ref = parseNeedle(args[0])
      if (!ref) continue
      onNeedle[needleKey(ref.bed, ref.n, ref.slider)] = []
      continue
    }

    if (op === 'knit' || op === 'tuck') {
      const dir = args[0] as '+' | '-'
      const ref = parseNeedle(args[1])
      const carrier = args[2] || '7'
      if (!ref) continue
      if (lastDir && dir !== lastDir) {
        courseY += SH
        courseIndex += 1
      }
      lastDir = dir
      const key = needleKey(ref.bed, ref.n, ref.slider)
      const x = ref.n * NS + (ref.bed === 'b' ? rack * NS : 0)
      const z = bedZ(ref.bed)
      const isTuck = op === 'tuck'
      const useOffset = opts?.courseOffset !== false
      const courseOffsetX = useOffset ? (courseIndex % 2 === 1 ? 1 : -1) * NS * 0.12 : 0
      const courseOffsetZ = useOffset ? (courseIndex % 2 === 1 ? 0.04 : -0.04) : 0
      let loopPts = placeLoop(isTuck ? localTuck : localKnit, x + courseOffsetX, courseY, z + courseOffsetZ)
      const existing = onNeedle[key] || []
      if (existing.length && !isTuck) {
        loopPts = interlockThrough(existing[existing.length - 1], loopPts)
      }
      const pathId = `stitch-${opIndex}-${stitchIndex++}`
      paths.push({
        id: pathId, carrier, color: COLORS[carrier] || '#aaa',
        lines: [line], kind: 'yarn', primaryLine: line, opIndex,
        points: loopPts.map((p) => ({ x: p.x, y: p.y, z: p.z, carrier, line, opIndex })),
      })
      const anchors = loopAnchors(loopPts)
      const live: LiveLoop = {
        needle: key, carrier, points: loopPts,
        top: anchors.top, bottom: anchors.bottom, left: anchors.left, right: anchors.right,
        line, opIndex, courseY, pathId,
      }
      if (isTuck) {
        if (!onNeedle[key]) onNeedle[key] = []
        onNeedle[key].push(live)
      } else {
        onNeedle[key] = [live]
      }
    }
  }

  const heldIds = new Set<string>()
  for (const stack of Object.values(onNeedle)) {
    for (const lp of stack) heldIds.add(lp.pathId)
  }
  for (const p of paths) {
    if (heldIds.has(p.id)) p.held = true
  }

  if (paths.length) {
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity
    for (const p of paths) {
      for (const pt of p.points) {
        minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y)
        minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x)
      }
    }
    const midY = (minY + maxY) / 2, midX = (minX + maxX) / 2
    for (const p of paths) {
      for (const pt of p.points) { pt.y -= midY; pt.x -= midX }
    }
  }
  return paths
}

export function pathsToOBJ(paths: YarnPath[]): string {
  const lines = ['# knitout-3d-visualizer export', 'o knitout']
  let off = 1
  for (const path of paths) {
    if (path.points.length < 2) continue
    for (const p of path.points) {
      lines.push(`v ${p.x.toFixed(5)} ${p.y.toFixed(5)} ${p.z.toFixed(5)}`)
    }
    for (let i = 0; i < path.points.length - 1; i++) {
      lines.push(`l ${off + i} ${off + i + 1}`)
    }
    off += path.points.length
  }
  return lines.join('\n')
}

export { COLORS }
