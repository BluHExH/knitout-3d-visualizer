import { create } from 'zustand'
import {
  interpretKnitout,
  occupiedNeedles,
  type MachineError,
  type Operation,
  type MachineSnapshot,
} from './machine'
import type { YarnPath } from './types'
import { buildGeometry, linkCarrierPaths, relaxPaths, pathsToOBJ } from './geometry'

export type { YarnPoint, YarnPath } from './types'

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
  yarnRadius: number
  courseOffset: boolean
  gauge: number
  showNeedleLabels: boolean
  setCode: (c: string) => void
  setSelectedLine: (l: number | null) => void
  setJumpToLine: (l: number | null) => void
  setSelectedOpIndex: (i: number | null) => void
  setShowUpToOp: (i: number | null) => void
  setGhostPast: (v: boolean) => void
  setHighlightCurrentOnly: (v: boolean) => void
  setYarnRadius: (v: number) => void
  setCourseOffset: (v: boolean) => void
  setGauge: (v: number) => void
  setShowNeedleLabels: (v: boolean) => void
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
;; multi-carrier sample: blue(7) then teal(5), 8 needles + transfer
inhook 7
tuck - f7 7
tuck - f5 7
tuck - f3 7
tuck - f1 7
tuck + f0 7
tuck + f2 7
tuck + f4 7
tuck + f6 7
knit - f7 7
knit - f6 7
knit - f5 7
knit - f4 7
knit - f3 7
knit - f2 7
knit - f1 7
knit - f0 7
releasehook 7
knit + f0 7
knit + f1 7
knit + f2 7
knit + f3 7
knit + f4 7
knit + f5 7
knit + f6 7
knit + f7 7
knit - f7 7
knit - f6 7
knit - f5 7
knit - f4 7
knit - f3 7
knit - f2 7
knit - f1 7
knit - f0 7
outhook 7
inhook 5
knit + f0 5
knit + f1 5
knit + f2 5
knit + f3 5
knit + f4 5
knit + f5 5
knit + f6 5
knit + f7 5
knit - f7 5
knit - f6 5
knit - f5 5
knit - f4 5
knit - f3 5
knit - f2 5
knit - f1 5
knit - f0 5
xfer f0 b0
xfer f1 b1
xfer f2 b2
xfer f3 b3
xfer f4 b4
xfer f5 b5
xfer f6 b6
xfer f7 b7
knit + b0 5
knit + b1 5
knit + b2 5
knit + b3 5
knit + b4 5
knit + b5 5
knit + b6 5
knit + b7 5
knit - b7 5
knit - b6 5
knit - b5 5
knit - b4 5
knit - b3 5
knit - b2 5
knit - b1 5
knit - b0 5
xfer b0 f0
xfer b1 f1
xfer b2 f2
xfer b3 f3
xfer b4 f4
xfer b5 f5
xfer b6 f6
xfer b7 f7
knit + f0 5
knit + f1 5
knit + f2 5
knit + f3 5
knit + f4 5
knit + f5 5
knit + f6 5
knit + f7 5
outhook 5
`

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
  physicsIters: 56,
  yarnRadius: 1,
  courseOffset: true,
  gauge: 1,
  showNeedleLabels: true,

  setCode: (code) => set({ code }),
  setSelectedLine: (line) => set({ selectedLine: line }),
  setJumpToLine: (line) => set({ jumpToLine: line }),
  setSelectedOpIndex: (i) => set({ selectedOpIndex: i, showUpToOp: i }),
  setShowUpToOp: (i) => set({ showUpToOp: i }),
  setGhostPast: (v) => set({ ghostPast: v }),
  setHighlightCurrentOnly: (v) => set({ highlightCurrentOnly: v }),
  setYarnRadius: (v) => set({ yarnRadius: Math.min(1.8, Math.max(0.45, v)) }),
  setCourseOffset: (v) => set({ courseOffset: v }),
  setGauge: (v) => set({ gauge: Math.min(1.5, Math.max(0.6, v)) }),
  setShowNeedleLabels: (v) => set({ showNeedleLabels: v }),
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
      let yarnPaths = buildGeometry(operations, { courseOffset: get().courseOffset, gauge: get().gauge })
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
      yarnPaths: relaxPaths(yarnPaths, Math.max(physicsIters, 64)),
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
