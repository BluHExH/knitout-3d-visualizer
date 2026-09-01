import { create } from 'zustand'
import {
  interpretKnitout,
  occupiedNeedles,
  type MachineError,
  type Operation,
  type MachineSnapshot,
  parseNeedle,
  needleKey,
} from './machine'

export type YarnPoint = {
  x: number
  y: number
  z: number
  carrier?: string
  line: number
  opIndex?: number
}

export type YarnPath = {
  id: string
  carrier: string
  points: YarnPoint[]
  color: string
  lines: number[]
  kind: 'yarn' | 'transfer' | 'carrier'
  primaryLine: number
  opIndex?: number
  held?: boolean
}

type State = {
  code: string
  yarnPaths: YarnPath[]
  operations: Operation[]
  errors: MachineError[]
  finalState: MachineSnapshot | null
  occupied: ReturnType<typeof occupiedNeedles>
  selectedLine: number | null
  selectedYarnId: string | null
  selectedOpIndex: number | null
  error: string | null
  isRunning: boolean
  jumpToLine: number | null
  relaxed: boolean
  isPlaying: boolean
  playSpeedMs: number
  showUpToOp: number | null
  ghostPast: boolean
  highlightCurrentOnly: boolean
  physicsIters: number
  setCode: (c: string) => void
  setSelectedLine: (l: number | null) => void
  setJumpToLine: (l: number | null) => void
  setSelectedOpIndex: (i: number | null) => void
  setShowUpToOp: (i: number | null) => void
  setGhostPast: (v: boolean) => void
  setHighlightCurrentOnly: (v: boolean) => void
  selectYarn: (id: string | null, line?: number | null) => void
  run: () => void
  relax: () => void
  exportOBJ: () => void
  play: () => void
  pause: () => void
  stepNext: () => void
  stepPrev: () => void
  stopPlay: () => void
}

const DEFAULT_CODE = `;!knitout-2
;;Carriers: 1 2 3 4 5 6 7 8 9 10
inhook 7
tuck - f3 7
tuck - f1 7
tuck + f0 7
tuck + f2 7
knit - f3 7
knit - f2 7
knit - f1 7
knit - f0 7
releasehook 7
knit + f0 7
knit + f1 7
knit + f2 7
knit + f3 7
xfer f0 b0
xfer f1 b1
xfer f2 b2
xfer f3 b3
knit - b3 7
knit - b2 7
knit - b1 7
knit - b0 7
xfer b0 f0
xfer b1 f1
xfer b2 f2
xfer b3 f3
knit + f0 7
knit + f1 7
knit + f2 7
knit + f3 7
outhook 7
`

const COLORS: Record<string, string> = {
  '1': '#ef4444', '2': '#f97316', '3': '#eab308', '4': '#22c55e', '5': '#14b8a6',
  '6': '#06b6d4', '7': '#3b82f6', '8': '#8b5cf6', '9': '#ec4899', '10': '#f43f5e',
}

const NEEDLE_SPACING = 1.15
const BED_GAP = 3.2
const STITCH_HEIGHT = 0.95
const LOOP_W = 0.38
const LOOP_H = 0.52

const bedZ = (bed: string) => (bed === 'f' ? -BED_GAP / 2 : BED_GAP / 2)

type LiveLoop = {
  needle: string
  carrier: string
  points: { x: number; y: number; z: number }[]
  top: { x: number; y: number; z: number }
  bottom: { x: number; y: number; z: number }
  line: number
  opIndex: number
  courseY: number
  pathId: string
}

function classicLoopLocal(w: number, h: number, samples = 20, tuck = false) {
  const pts: { x: number; y: number; z: number }[] = []
  const ww = tuck ? w * 0.72 : w
  const hh = tuck ? h * 0.65 : h
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const cx = Math.cos(t)
    const sy = Math.sin(t)
    const widthMod = 1 + 0.18 * Math.max(0, -sy)
    const heightMod = sy > 0 ? 0.92 : 1.05
    const px = cx * ww * widthMod
    const py = sy * hh * heightMod - (sy > 0 ? -0.04 : 0.1)
    const pz = Math.sin(t * 2) * 0.06 * (tuck ? 0.5 : 1)
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

function interlockThrough(
  prev: LiveLoop,
  nextPts: { x: number; y: number; z: number }[]
) {
  const midY = nextPts.reduce((s, p) => s + p.y, 0) / Math.max(1, nextPts.length)
  return nextPts.map((p) => {
    if (p.y >= midY) return { ...p }
    const t = 0.45
    return {
      x: p.x * (1 - t) + prev.top.x * t,
      y: Math.min(p.y, prev.top.y - 0.14),
      z: p.z * (1 - t) + prev.top.z * t,
    }
  })
}

function loopAnchors(pts: { x: number; y: number; z: number }[]) {
  let top = pts[0]
  let bottom = pts[0]
  for (const p of pts) {
    if (p.y > top.y) top = p
    if (p.y < bottom.y) bottom = p
  }
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length
  return {
    top: { x: cx, y: top.y, z: cz },
    bottom: { x: cx, y: bottom.y, z: cz },
  }
}

function linkCarrierPaths(paths: YarnPath[]): YarnPath[] {
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
      const last = a.points[Math.floor(a.points.length * 0.7)]
      const first = b.points[Math.floor(b.points.length * 0.3)]
      const mid = {
        x: (last.x + first.x) / 2,
        y: (last.y + first.y) / 2 - 0.08,
        z: (last.z + first.z) / 2,
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
          { ...mid, carrier, line: a.primaryLine, opIndex: a.opIndex },
          { ...first, carrier, line: b.primaryLine, opIndex: b.opIndex },
        ],
      })
    }
  }
  return [...paths, ...extras]
}

function relaxPaths(
  paths: YarnPath[],
  iterations = 48,
  opts: { stiffness?: number; bend?: number; gravity?: number; repulsion?: number } = {}
): YarnPath[] {
  const stiffness = opts.stiffness ?? 0.42
  const bend = opts.bend ?? 0.22
  const gravity = opts.gravity ?? 0.01
  const repulsion = opts.repulsion ?? 0.09
  const restScale = 0.96

  const result = paths.map((p) => ({
    ...p,
    points: p.points.map((pt) => ({ ...pt })),
  }))

  const restLens: number[][] = result.map((path) => {
    const lens: number[] = []
    for (let i = 0; i < path.points.length - 1; i++) {
      const a = path.points[i]
      const b = path.points[i + 1]
      lens.push(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * restScale)
    }
    return lens
  })

  for (let iter = 0; iter < iterations; iter++) {
    for (let pi = 0; pi < result.length; pi++) {
      const path = result[pi]
      if (path.points.length < 3) continue
      const pts = path.points
      const n = pts.length
      const forces = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }))

      for (let i = 0; i < n - 1; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        const dist = Math.hypot(dx, dy, dz) || 1e-6
        const rest = restLens[pi][i] || dist
        const f = (stiffness * (dist - rest)) / dist
        forces[i].x += dx * f
        forces[i].y += dy * f
        forces[i].z += dz * f
        forces[i + 1].x -= dx * f
        forces[i + 1].y -= dy * f
        forces[i + 1].z -= dz * f
      }

      for (let i = 1; i < n - 1; i++) {
        const targetX = (pts[i - 1].x + pts[i + 1].x) * 0.5
        const targetY = (pts[i - 1].y + pts[i + 1].y) * 0.5
        const targetZ = (pts[i - 1].z + pts[i + 1].z) * 0.5
        forces[i].x += (targetX - pts[i].x) * bend
        forces[i].y += (targetY - pts[i].y) * bend
        forces[i].z += (targetZ - pts[i].z) * bend
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 4; j < n; j++) {
          const dx = pts[j].x - pts[i].x
          const dy = pts[j].y - pts[i].y
          const dz = pts[j].z - pts[i].z
          const d2 = dx * dx + dy * dy + dz * dz
          const minD = path.kind === 'carrier' ? 0.14 : 0.22
          if (d2 < minD * minD && d2 > 1e-8) {
            const d = Math.sqrt(d2)
            const push = (repulsion * (minD - d)) / d
            forces[i].x -= dx * push
            forces[i].y -= dy * push
            forces[i].z -= dz * push
            forces[j].x += dx * push
            forces[j].y += dy * push
            forces[j].z += dz * push
          }
        }
      }

      for (let i = 0; i < n; i++) {
        const isEnd = i === 0 || i === n - 1
        const damp = isEnd ? 0.18 : 0.82
        pts[i].x += forces[i].x * damp
        pts[i].y += forces[i].y * damp - gravity * damp
        pts[i].z += forces[i].z * damp
      }
    }
  }
  return result
}

function buildGeometry(operations: Operation[]): YarnPath[] {
  const paths: YarnPath[] = []
  let rack = 0
  let courseY = 0
  let lastDir: '+' | '-' | null = null
  let stitchIndex = 0
  const onNeedle: Record<string, LiveLoop[]> = {}
  const localKnit = classicLoopLocal(LOOP_W, LOOP_H, 20, false)
  const localTuck = classicLoopLocal(LOOP_W, LOOP_H, 16, true)

  for (const operation of operations) {
    const { op, args, line, index: opIndex } = operation

    if (op === 'rack') {
      rack = parseFloat(args[0]) || 0
      continue
    }

    if (op === 'xfer') {
      const from = parseNeedle(args[0])
      const to = parseNeedle(args[1])
      if (!from || !to) continue
      const fromKey = needleKey(from.bed, from.n, from.slider)
      const toKey = needleKey(to.bed, to.n, to.slider)
      const stack = onNeedle[fromKey] || []
      if (!stack.length) continue
      const loops = stack.splice(0, stack.length)
      if (!onNeedle[toKey]) onNeedle[toKey] = []
      const toX = to.n * NEEDLE_SPACING + (to.bed === 'b' ? rack * NEEDLE_SPACING : 0)
      const toZ = bedZ(to.bed)

      for (const lp of loops) {
        const fromC = {
          x: lp.points.reduce((s, p) => s + p.x, 0) / lp.points.length,
          y: lp.points.reduce((s, p) => s + p.y, 0) / lp.points.length,
          z: lp.points.reduce((s, p) => s + p.z, 0) / lp.points.length,
        }
        const toC = { x: toX, y: courseY + 0.15, z: toZ }
        const xferPts: YarnPoint[] = []
        for (let i = 0; i <= 14; i++) {
          const t = i / 14
          xferPts.push({
            x: fromC.x + (toC.x - fromC.x) * t,
            y: fromC.y + (toC.y - fromC.y) * t + Math.sin(t * Math.PI) * 1.05,
            z: fromC.z + (toC.z - fromC.z) * t,
            line,
            opIndex,
          })
        }
        paths.push({
          id: `xfer-${opIndex}-${lp.carrier}`,
          carrier: 'xfer',
          color: '#fbbf24',
          lines: [line],
          kind: 'transfer',
          primaryLine: line,
          opIndex,
          points: xferPts,
        })
        const moved = placeLoop(localKnit, toX, courseY, toZ)
        const anchors = loopAnchors(moved)
        lp.points = moved
        lp.top = anchors.top
        lp.bottom = anchors.bottom
        lp.needle = toKey
        onNeedle[toKey].push(lp)
      }
      continue
    }

    if (op === 'drop') {
      const ref = parseNeedle(args[0])
      if (!ref) continue
      const key = needleKey(ref.bed, ref.n, ref.slider)
      onNeedle[key] = []
      continue
    }

    if (op === 'knit' || op === 'tuck') {
      const dir = args[0] as '+' | '-'
      const ref = parseNeedle(args[1])
      const carrier = args[2] || '7'
      if (!ref) continue

      if (lastDir && dir !== lastDir) courseY += STITCH_HEIGHT
      lastDir = dir

      const key = needleKey(ref.bed, ref.n, ref.slider)
      const x = ref.n * NEEDLE_SPACING + (ref.bed === 'b' ? rack * NEEDLE_SPACING : 0)
      const z = bedZ(ref.bed)
      const y = courseY
      const isTuck = op === 'tuck'

      let loopPts = placeLoop(isTuck ? localTuck : localKnit, x, y, z)
      const existing = onNeedle[key] || []
      if (existing.length && !isTuck) {
        loopPts = interlockThrough(existing[existing.length - 1], loopPts)
      }

      const pathId = `stitch-${opIndex}-${stitchIndex++}`
      paths.push({
        id: pathId,
        carrier,
        color: COLORS[carrier] || '#aaa',
        lines: [line],
        kind: 'yarn',
        primaryLine: line,
        opIndex,
        points: loopPts.map((p) => ({
          x: p.x, y: p.y, z: p.z, carrier, line, opIndex,
        })),
      })

      const anchors = loopAnchors(loopPts)
      const live: LiveLoop = {
        needle: key,
        carrier,
        points: loopPts,
        top: anchors.top,
        bottom: anchors.bottom,
        line,
        opIndex,
        courseY: y,
        pathId,
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
        minY = Math.min(minY, pt.y)
        maxY = Math.max(maxY, pt.y)
        minX = Math.min(minX, pt.x)
        maxX = Math.max(maxX, pt.x)
      }
    }
    const midY = (minY + maxY) / 2
    const midX = (minX + maxX) / 2
    for (const p of paths) {
      for (const pt of p.points) {
        pt.y -= midY
        pt.x -= midX
      }
    }
  }

  return paths
}

function pathsToOBJ(paths: YarnPath[]): string {
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

export const useStore = create<State>((set, get) => ({
  code: DEFAULT_CODE,
  yarnPaths: [],
  operations: [],
  errors: [],
  finalState: null,
  occupied: [],
  selectedLine: null,
  selectedYarnId: null,
  selectedOpIndex: null,
  error: null,
  isRunning: false,
  jumpToLine: null,
  relaxed: false,
  isPlaying: false,
  playSpeedMs: 320,
  showUpToOp: null,
  ghostPast: true,
  highlightCurrentOnly: false,
  physicsIters: 48,

  setCode: (code) => set({ code }),
  setSelectedLine: (line) => set({ selectedLine: line }),
  setJumpToLine: (line) => set({ jumpToLine: line }),
  setSelectedOpIndex: (i) => set({ selectedOpIndex: i, showUpToOp: i }),
  setShowUpToOp: (i) => set({ showUpToOp: i }),
  setGhostPast: (v) => set({ ghostPast: v }),
  setHighlightCurrentOnly: (v) => set({ highlightCurrentOnly: v }),
  selectYarn: (id, line = null) =>
    set({ selectedYarnId: id, selectedLine: line ?? null, jumpToLine: line ?? null }),

  run: () => {
    const { code, physicsIters } = get()
    set({
      isRunning: true,
      error: null,
      selectedLine: null,
      selectedYarnId: null,
      selectedOpIndex: null,
      showUpToOp: null,
      relaxed: false,
    })
    try {
      const { operations, errors, finalState } = interpretKnitout(code)
      let yarnPaths = buildGeometry(operations)
      yarnPaths = linkCarrierPaths(yarnPaths)
      yarnPaths = relaxPaths(yarnPaths, physicsIters)
      set({
        operations,
        errors,
        finalState,
        occupied: occupiedNeedles(finalState),
        yarnPaths,
        isRunning: false,
        relaxed: true,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      set({ error: msg, isRunning: false })
    }
  },

  relax: () => {
    const { yarnPaths, physicsIters } = get()
    if (!yarnPaths.length) return
    set({
      yarnPaths: relaxPaths(yarnPaths, Math.max(physicsIters, 56)),
      relaxed: true,
    })
  },

  exportOBJ: () => {
    const { yarnPaths } = get()
    if (!yarnPaths.length) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([pathsToOBJ(yarnPaths)], { type: 'text/plain' }))
    a.download = 'knitout-export.obj'
    a.click()
  },

  play: () => {
    const { operations, selectedOpIndex, isPlaying } = get()
    if (!operations.length || isPlaying) return
    set({ isPlaying: true })
    let i = selectedOpIndex === null ? 0 : selectedOpIndex
    const tick = () => {
      const st = get()
      if (!st.isPlaying) return
      if (i >= st.operations.length) {
        set({ isPlaying: false })
        return
      }
      const op = st.operations[i]
      set({
        selectedOpIndex: op.index,
        selectedLine: op.line,
        jumpToLine: op.line,
        showUpToOp: op.index,
      })
      i++
      setTimeout(tick, st.playSpeedMs)
    }
    tick()
  },

  pause: () => set({ isPlaying: false }),
  stopPlay: () => set({ isPlaying: false, selectedOpIndex: null, showUpToOp: null }),

  stepNext: () => {
    const { operations, selectedOpIndex } = get()
    if (!operations.length) return
    const next = Math.min((selectedOpIndex === null ? -1 : selectedOpIndex) + 1, operations.length - 1)
    const op = operations[next]
    set({
      isPlaying: false,
      selectedOpIndex: op.index,
      selectedLine: op.line,
      jumpToLine: op.line,
      showUpToOp: op.index,
    })
  },

  stepPrev: () => {
    const { operations, selectedOpIndex } = get()
    if (!operations.length) return
    const prev = Math.max((selectedOpIndex === null ? 0 : selectedOpIndex) - 1, 0)
    const op = operations[prev]
    set({
      isPlaying: false,
      selectedOpIndex: op.index,
      selectedLine: op.line,
      jumpToLine: op.line,
      showUpToOp: op.index,
    })
  },
}))
