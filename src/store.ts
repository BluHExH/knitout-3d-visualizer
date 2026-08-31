import { create } from 'zustand'

export type YarnPoint = {
  x: number
  y: number
  z: number
  carrier?: string
  line: number // 1-based source line
}

export type YarnPath = {
  id: string
  carrier: string
  points: YarnPoint[]
  color: string
  /** All source lines that contributed to this path */
  lines: number[]
}

type State = {
  code: string
  yarnPaths: YarnPath[]
  selectedLine: number | null
  selectedYarnId: string | null
  error: string | null
  isRunning: boolean
  /** When a yarn is clicked we set this so Monaco can jump */
  jumpToLine: number | null

  setCode: (code: string) => void
  setYarnPaths: (paths: YarnPath[]) => void
  setSelectedLine: (line: number | null) => void
  setSelectedYarnId: (id: string | null) => void
  setError: (err: string | null) => void
  setIsRunning: (v: boolean) => void
  setJumpToLine: (line: number | null) => void
  run: () => void
  selectYarn: (id: string | null, line?: number | null) => void
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
knit - f3 7
knit - f2 7
knit - f1 7
knit - f0 7
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

/**
 * Basic knitout → 3D yarn path converter.
 * Each point stores the 1-based source line number for bidirectional linking.
 */
function parseAndBuildYarnPaths(code: string): { paths: YarnPath[]; error: string | null } {
  const lines = code.split('\n')
  const paths: YarnPath[] = []
  let currentCarrier = '7'
  let currentPath: YarnPath | null = null
  let rack = 0
  let y = 0
  const needleSpacing = 1.0
  const bedGap = 2.5

  try {
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1 // 1-based
      const raw = lines[i].trim()
      if (!raw || raw.startsWith(';') || raw.startsWith(';;')) continue

      const parts = raw.split(/\s+/)
      const op = parts[0].toLowerCase()

      if (op === 'inhook' || op === 'in') {
        currentCarrier = parts[1] || '7'
        currentPath = {
          id: `yarn-${currentCarrier}-${i}`,
          carrier: currentCarrier,
          points: [],
          color: CARRIER_COLORS[currentCarrier] || '#aaaaaa',
          lines: [lineNum],
        }
        paths.push(currentPath)
      } else if (op === 'outhook' || op === 'out') {
        if (currentPath) currentPath.lines.push(lineNum)
        currentPath = null
      } else if (op === 'releasehook') {
        if (currentPath) currentPath.lines.push(lineNum)
      } else if (op === 'tuck' || op === 'knit' || op === 'miss') {
        const needle = parts[2]
        const carrier = parts[3] || currentCarrier

        if (!currentPath || currentPath.carrier !== carrier) {
          currentPath = {
            id: `yarn-${carrier}-${i}`,
            carrier,
            points: [],
            color: CARRIER_COLORS[carrier] || '#aaaaaa',
            lines: [],
          }
          paths.push(currentPath)
        }

        currentPath.lines.push(lineNum)

        const match = needle?.match(/^(f|b)(s?)(-?\d+)$/i)
        if (!match) continue
        const bed = match[1].toLowerCase()
        const n = parseInt(match[3], 10)

        const x = n * needleSpacing + (bed === 'b' ? rack : 0)
        const z = bed === 'f' ? -bedGap / 2 : bedGap / 2
        const yy = y
        const r = 0.35

        currentPath.points.push({ x: x - r, y: yy, z, carrier, line: lineNum })
        currentPath.points.push({ x: x, y: yy + r * 0.8, z, carrier, line: lineNum })
        currentPath.points.push({ x: x + r, y: yy, z, carrier, line: lineNum })
        currentPath.points.push({ x: x, y: yy - r * 0.3, z, carrier, line: lineNum })

        y += 0.15
      } else if (op === 'xfer') {
        // MVP: skip detailed geometry
      } else if (op === 'rack') {
        rack = parseFloat(parts[1] || '0')
      }
    }

    // center Y
    if (paths.length > 0) {
      let minY = Infinity
      let maxY = -Infinity
      for (const p of paths) {
        for (const pt of p.points) {
          minY = Math.min(minY, pt.y)
          maxY = Math.max(maxY, pt.y)
        }
      }
      const mid = (minY + maxY) / 2
      for (const p of paths) {
        for (const pt of p.points) pt.y -= mid
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
  setYarnPaths: (paths) => set({ yarnPaths: paths }),
  setSelectedLine: (line) => set({ selectedLine: line }),
  setSelectedYarnId: (id) => set({ selectedYarnId: id }),
  setError: (err) => set({ error: err }),
  setIsRunning: (v) => set({ isRunning: v }),
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
