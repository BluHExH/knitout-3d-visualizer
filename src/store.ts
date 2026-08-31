import { create } from 'zustand'

export type YarnPoint = {
  x: number
  y: number
  z: number
  carrier?: string
  line: number // 1-based
}

export type YarnPath = {
  id: string
  carrier: string
  points: YarnPoint[]
  color: string
  lines: number[]
  kind: 'yarn' | 'transfer'
}

type State = {
  code: string
  yarnPaths: YarnPath[]
  selectedLine: number | null
  selectedYarnId: string | null
  error: string | null
  isRunning: boolean
  jumpToLine: number | null

  setCode: (code: string) => void
  setSelectedLine: (line: number | null) => void
  setJumpToLine: (line: number | null) => void
  selectYarn: (id: string | null, line?: number | null) => void
  run: () => void
}

const DEFAULT_CODE = `;!knitout-2
;;Carriers: 1 2 3 4 5 6 7 8 9 10
inhook 7
; alternating tucks cast-on
tuck - f3 7
tuck - f1 7
tuck + f0 7
tuck + f2 7
; first course
knit - f3 7
knit - f2 7
knit - f1 7
knit - f0 7
releasehook 7
; second course
knit + f0 7
knit + f1 7
knit + f2 7
knit + f3 7
; transfers to back bed
xfer f0 b0
xfer f1 b1
xfer f2 b2
xfer f3 b3
; knit on back
knit - b3 7
knit - b2 7
knit - b1 7
knit - b0 7
; transfer back to front
xfer b0 f0
xfer b1 f1
xfer b2 f2
xfer b3 f3
; final course
knit + f0 7
knit + f1 7
knit + f2 7
knit + f3 7
outhook 7
`

const CARRIER_COLORS: Record<string, string> = {
  '1': '#ef4444',
  '2': '#f97316',
  '3': '#eab308',
  '4': '#22c55e',
  '5': '#14b8a6',
  '6': '#06b6d4',
  '7': '#3b82f6',
  '8': '#8b5cf6',
  '9': '#ec4899',
  '10': '#f43f5e',
}

const NEEDLE_SPACING = 1.15
const BED_GAP = 3.2
const STITCH_HEIGHT = 0.95

type NeedleKey = string

function needleKey(bed: string, n: number, slider = false): NeedleKey {
  return `${bed}${slider ? 's' : ''}${n}`
}

function parseNeedle(raw: string): { bed: string; n: number; slider: boolean } | null {
  const m = raw?.match(/^(f|b)(s?)(-?\d+)$/i)
  if (!m) return null
  return {
    bed: m[1].toLowerCase(),
    slider: m[2] === 's',
    n: parseInt(m[3], 10),
  }
}

function bedZ(bed: string): number {
  return bed === 'f' ? -BED_GAP / 2 : BED_GAP / 2
}

/**
 * Improved topological placement:
 * - Front / back beds clearly separated in Z
 * - Each course advances Y
 * - Stitches get a proper loop shape
 * - Transfers drawn as arcs between beds
 */
function parseAndBuildYarnPaths(code: string): { paths: YarnPath[]; error: string | null } {
  const lines = code.split('\n')
  const paths: YarnPath[] = []

  let currentCarrier = '7'
  let currentPath: YarnPath | null = null
  let rack = 0
  let courseY = 0
  let lastNeedle: { bed: string; n: number } | null = null
  let dir: '+' | '-' = '+'

  const needlePos: Record<NeedleKey, { x: number; y: number; z: number }> = {}

  const ensurePath = (carrier: string, lineNum: number) => {
    if (!currentPath || currentPath.carrier !== carrier || currentPath.kind !== 'yarn') {
      currentPath = {
        id: `yarn-${carrier}-${lineNum}`,
        carrier,
        points: [],
        color: CARRIER_COLORS[carrier] || '#aaaaaa',
        lines: [],
        kind: 'yarn',
      }
      paths.push(currentPath)
    }
    if (!currentPath.lines.includes(lineNum)) currentPath.lines.push(lineNum)
    return currentPath
  }

  const addStitch = (
    bed: string,
    n: number,
    carrier: string,
    lineNum: number,
    isTuck = false
  ) => {
    const path = ensurePath(carrier, lineNum)
    const x = n * NEEDLE_SPACING + (bed === 'b' ? rack * NEEDLE_SPACING : 0)
    const z = bedZ(bed)
    const y = courseY

    const w = isTuck ? 0.28 : 0.38
    const h = isTuck ? 0.32 : 0.48

    const pts: [number, number, number][] = [
      [x - w, y - h * 0.15, z],
      [x - w * 0.7, y + h * 0.35, z],
      [x, y + h * 0.55, z],
      [x + w * 0.7, y + h * 0.35, z],
      [x + w, y - h * 0.15, z],
      [x + w * 0.4, y - h * 0.45, z],
      [x, y - h * 0.35, z],
      [x - w * 0.4, y - h * 0.45, z],
      [x - w, y - h * 0.15, z],
    ]

    for (const [px, py, pz] of pts) {
      path.points.push({ x: px, y: py, z: pz, carrier, line: lineNum })
    }

    needlePos[needleKey(bed, n)] = { x, y, z }
    lastNeedle = { bed, n }
  }

  const addTransfer = (
    from: { bed: string; n: number },
    to: { bed: string; n: number },
    lineNum: number
  ) => {
    const fromKey = needleKey(from.bed, from.n)
    const toKey = needleKey(to.bed, to.n)

    const fromP = needlePos[fromKey] || {
      x: from.n * NEEDLE_SPACING,
      y: courseY,
      z: bedZ(from.bed),
    }
    const toP = {
      x: to.n * NEEDLE_SPACING + (to.bed === 'b' ? rack * NEEDLE_SPACING : 0),
      y: courseY + 0.15,
      z: bedZ(to.bed),
    }

    const transferPath: YarnPath = {
      id: `xfer-${lineNum}`,
      carrier: 'xfer',
      color: '#fbbf24',
      lines: [lineNum],
      kind: 'transfer',
      points: [],
    }

    const steps = 10
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = fromP.x + (toP.x - fromP.x) * t
      const z = fromP.z + (toP.z - fromP.z) * t
      const lift = Math.sin(t * Math.PI) * 0.9
      const y = fromP.y + (toP.y - fromP.y) * t + lift
      transferPath.points.push({ x, y, z, line: lineNum })
    }

    paths.push(transferPath)
    needlePos[toKey] = toP
    delete needlePos[fromKey]
  }

  try {
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1
      const raw = lines[i].trim()
      if (!raw || raw.startsWith(';')) continue

      const parts = raw.split(/\s+/)
      const op = parts[0].toLowerCase()

      if (op === 'inhook' || op === 'in') {
        currentCarrier = parts[1] || '7'
        currentPath = null
      } else if (op === 'outhook' || op === 'out') {
        currentPath = null
      } else if (op === 'releasehook') {
        // no geometry
      } else if (op === 'tuck' || op === 'knit' || op === 'miss') {
        const d = parts[1] as '+' | '-'
        const needleRaw = parts[2]
        const carrier = parts[3] || currentCarrier
        const parsed = parseNeedle(needleRaw)
        if (!parsed) continue

        if (lastNeedle && d !== dir) {
          courseY += STITCH_HEIGHT
        }
        dir = d

        if (op === 'miss') {
          lastNeedle = { bed: parsed.bed, n: parsed.n }
        } else {
          addStitch(parsed.bed, parsed.n, carrier, lineNum, op === 'tuck')
        }
      } else if (op === 'xfer') {
        const from = parseNeedle(parts[1])
        const to = parseNeedle(parts[2])
        if (from && to) addTransfer(from, to, lineNum)
      } else if (op === 'rack') {
        rack = parseFloat(parts[1] || '0')
      }
    }

    if (paths.length > 0) {
      let minY = Infinity
      let maxY = -Infinity
      let minX = Infinity
      let maxX = -Infinity
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

    return { paths, error: null }
  } catch (e: any) {
    return { paths: [], error: e.message || String(e) }
  }
}

export const useStore = create<State>((set, get) => ({
  code: DEFAULT_CODE,
  yarnPaths: [],
  selectedLine: null,
  selectedYarnId: null,
  error: null,
  isRunning: false,
  jumpToLine: null,

  setCode: (code) => set({ code }),
  setSelectedLine: (line) => set({ selectedLine: line }),
  setJumpToLine: (line) => set({ jumpToLine: line }),

  selectYarn: (id, line = null) => {
    set({ selectedYarnId: id, selectedLine: line ?? null, jumpToLine: line ?? null })
  },

  run: () => {
    const { code } = get()
    set({ isRunning: true, error: null, selectedLine: null, selectedYarnId: null })
    const { paths, error } = parseAndBuildYarnPaths(code)
    set({ yarnPaths: paths, error, isRunning: false })
  },
}))
