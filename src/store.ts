import { create } from 'zustand'
import { interpretKnitout, occupiedNeedles, type MachineError, type Operation, type MachineSnapshot, parseNeedle, needleKey } from './machine'

export type YarnPoint = { x: number; y: number; z: number; carrier?: string; line: number; opIndex?: number }
export type YarnPath = { id: string; carrier: string; points: YarnPoint[]; color: string; lines: number[]; kind: 'yarn' | 'transfer'; primaryLine: number; opIndex?: number }

type State = {
  code: string; yarnPaths: YarnPath[]; operations: Operation[]; errors: MachineError[]
  finalState: MachineSnapshot | null; occupied: ReturnType<typeof occupiedNeedles>
  selectedLine: number | null; selectedYarnId: string | null; selectedOpIndex: number | null
  error: string | null; isRunning: boolean; jumpToLine: number | null; relaxed: boolean
  isPlaying: boolean; playSpeedMs: number
  setCode: (c: string) => void; setSelectedLine: (l: number | null) => void; setJumpToLine: (l: number | null) => void
  setSelectedOpIndex: (i: number | null) => void; selectYarn: (id: string | null, line?: number | null) => void
  run: () => void; relax: () => void; exportOBJ: () => void
  play: () => void; pause: () => void; stepNext: () => void; stepPrev: () => void; stopPlay: () => void
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
const NS = 1.2, BG = 3.4, SH = 1.05
const bedZ = (b: string) => (b === 'f' ? -BG / 2 : BG / 2)

function makeLoop(cx: number, cy: number, cz: number, w = 0.42, h = 0.55, n = 14) {
  const pts: YarnPoint[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    pts.push({ x: cx + Math.cos(t) * w, y: cy + Math.sin(t) * h * 0.85 + (Math.sin(t) > 0 ? 0.08 : -0.12), z: cz, line: 0 })
  }
  return pts
}

function buildGeometry(operations: Operation[]): YarnPath[] {
  const paths: YarnPath[] = []
  let rack = 0, courseY = 0, lastDir: '+' | '-' | null = null, idx = 0
  const onNeedle: Record<string, { pts: { x: number; y: number; z: number }[] }> = {}

  for (const op of operations) {
    if (op.op === 'rack') { rack = parseFloat(op.args[0]) || 0; continue }
    if (op.op === 'xfer') {
      const from = parseNeedle(op.args[0]), to = parseNeedle(op.args[1])
      if (!from || !to) continue
      const fk = needleKey(from.bed, from.n, from.slider), tk = needleKey(to.bed, to.n, to.slider)
      const live = onNeedle[fk]
      if (!live) continue
      delete onNeedle[fk]
      const tx = to.n * NS + (to.bed === 'b' ? rack * NS : 0), tz = bedZ(to.bed)
      const fc = live.pts.reduce((a, p) => ({ x: a.x + p.x / live.pts.length, y: a.y + p.y / live.pts.length, z: a.z + p.z / live.pts.length }), { x: 0, y: 0, z: 0 })
      const xferPts: YarnPoint[] = []
      for (let i = 0; i <= 10; i++) {
        const t = i / 10
        xferPts.push({ x: fc.x + (tx - fc.x) * t, y: fc.y + (courseY + 0.2 - fc.y) * t + Math.sin(t * Math.PI) * 0.9, z: fc.z + (tz - fc.z) * t, line: op.line, opIndex: op.index })
      }
      paths.push({ id: `xfer-${op.index}`, carrier: 'xfer', color: '#fbbf24', lines: [op.line], kind: 'transfer', primaryLine: op.line, opIndex: op.index, points: xferPts })
      const loop = makeLoop(tx, courseY, tz)
      onNeedle[tk] = { pts: loop }
      continue
    }
    if (op.op === 'knit' || op.op === 'tuck') {
      const dir = op.args[0] as '+' | '-'
      const ref = parseNeedle(op.args[1])
      const carrier = op.args[2] || '7'
      if (!ref) continue
      if (lastDir && dir !== lastDir) courseY += SH
      lastDir = dir
      const key = needleKey(ref.bed, ref.n, ref.slider)
      const x = ref.n * NS + (ref.bed === 'b' ? rack * NS : 0)
      const z = bedZ(ref.bed)
      const isTuck = op.op === 'tuck'
      let loop = makeLoop(x, courseY, z, isTuck ? 0.3 : 0.42, isTuck ? 0.4 : 0.55)
      const prev = onNeedle[key]
      if (prev && !isTuck) {
        const cy = prev.pts.reduce((s, p) => s + p.y, 0) / prev.pts.length
        loop = loop.map((p) => (p.y < courseY ? { ...p, y: Math.min(p.y, cy - 0.1) } : p))
      }
      for (const p of loop) { p.line = op.line; p.opIndex = op.index; p.carrier = carrier }
      paths.push({ id: `s-${op.index}-${idx++}`, carrier, color: COLORS[carrier] || '#aaa', lines: [op.line], kind: 'yarn', primaryLine: op.line, opIndex: op.index, points: loop })
      onNeedle[key] = { pts: loop }
    }
  }
  if (paths.length) {
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity
    for (const p of paths) for (const pt of p.points) {
      minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y)
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x)
    }
    const my = (minY + maxY) / 2, mx = (minX + maxX) / 2
    for (const p of paths) for (const pt of p.points) { pt.y -= my; pt.x -= mx }
  }
  return paths
}

function relaxPaths(paths: YarnPath[], iterations = 30): YarnPath[] {
  const result = paths.map((p) => ({ ...p, points: p.points.map((pt) => ({ ...pt })) }))
  for (let iter = 0; iter < iterations; iter++) {
    for (const path of result) {
      if (path.points.length < 3) continue
      const pts = path.points
      const next = pts.map((p) => ({ ...p }))
      for (let i = 1; i < pts.length - 1; i++) {
        next[i].x = pts[i].x + 0.35 * ((pts[i - 1].x + pts[i + 1].x) * 0.5 - pts[i].x)
        next[i].y = pts[i].y + 0.35 * ((pts[i - 1].y + pts[i + 1].y) * 0.5 - pts[i].y) - 0.008
        next[i].z = pts[i].z + 0.35 * ((pts[i - 1].z + pts[i + 1].z) * 0.5 - pts[i].z)
      }
      path.points = next
    }
  }
  return result
}

function pathsToOBJ(paths: YarnPath[]): string {
  const lines = ['# knitout export', 'o knitout']
  let off = 1
  for (const path of paths) {
    if (path.points.length < 2) continue
    for (const p of path.points) lines.push(`v ${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)}`)
    for (let i = 0; i < path.points.length - 1; i++) lines.push(`l ${off + i} ${off + i + 1}`)
    off += path.points.length
  }
  return lines.join('\n')
}

export const useStore = create<State>((set, get) => ({
  code: DEFAULT_CODE, yarnPaths: [], operations: [], errors: [], finalState: null, occupied: [],
  selectedLine: null, selectedYarnId: null, selectedOpIndex: null, error: null, isRunning: false,
  jumpToLine: null, relaxed: false, isPlaying: false, playSpeedMs: 350,
  setCode: (code) => set({ code }),
  setSelectedLine: (line) => set({ selectedLine: line }),
  setJumpToLine: (line) => set({ jumpToLine: line }),
  setSelectedOpIndex: (i) => set({ selectedOpIndex: i }),
  selectYarn: (id, line = null) => set({ selectedYarnId: id, selectedLine: line ?? null, jumpToLine: line ?? null }),
  run: () => {
    const { code } = get()
    set({ isRunning: true, error: null, selectedLine: null, selectedYarnId: null, selectedOpIndex: null, relaxed: false })
    try {
      const { operations, errors, finalState } = interpretKnitout(code)
      let yarnPaths = buildGeometry(operations)
      yarnPaths = relaxPaths(yarnPaths, 28)
      set({ operations, errors, finalState, occupied: occupiedNeedles(finalState), yarnPaths, isRunning: false, relaxed: true })
    } catch (e: any) {
      set({ error: e.message || String(e), isRunning: false })
    }
  },
  relax: () => {
    const { yarnPaths } = get()
    if (!yarnPaths.length) return
    set({ yarnPaths: relaxPaths(yarnPaths, 40), relaxed: true })
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
      if (i >= st.operations.length) { set({ isPlaying: false }); return }
      const op = st.operations[i]
      set({ selectedOpIndex: op.index, selectedLine: op.line, jumpToLine: op.line })
      i++
      setTimeout(tick, st.playSpeedMs)
    }
    tick()
  },
  pause: () => set({ isPlaying: false }),
  stopPlay: () => set({ isPlaying: false, selectedOpIndex: null }),
  stepNext: () => {
    const { operations, selectedOpIndex } = get()
    if (!operations.length) return
    const next = Math.min((selectedOpIndex === null ? -1 : selectedOpIndex) + 1, operations.length - 1)
    const op = operations[next]
    set({ isPlaying: false, selectedOpIndex: op.index, selectedLine: op.line, jumpToLine: op.line })
  },
  stepPrev: () => {
    const { operations, selectedOpIndex } = get()
    if (!operations.length) return
    const prev = Math.max((selectedOpIndex === null ? 0 : selectedOpIndex) - 1, 0)
    const op = operations[prev]
    set({ isPlaying: false, selectedOpIndex: op.index, selectedLine: op.line, jumpToLine: op.line })
  },
}))
