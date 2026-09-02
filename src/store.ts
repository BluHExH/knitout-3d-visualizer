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
import { SAMPLES, getSample } from './samples'
import { JS_SAMPLES, getJsSample } from './jsSamples'
import { compileKnitoutJs } from './knitoutWriter'

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
  activeSampleId: string | null
  editorMode: 'knitout' | 'javascript'
  jsCode: string
  generatedKnitout: string | null
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
  loadSample: (id: string) => void
  loadCode: (code: string, sampleId?: string | null) => void
  setEditorMode: (m: 'knitout' | 'javascript') => void
  setJsCode: (c: string) => void
  loadJsSample: (id: string) => void
  runJs: () => void
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

const DEFAULT_CODE = SAMPLES[0].code

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
  activeSampleId: SAMPLES[0].id,
  editorMode: 'knitout',
  jsCode: JS_SAMPLES[0].code,
  generatedKnitout: null,

  setCode: (code) => set({ code, activeSampleId: null }),
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
  loadSample: (id) => {
    const s = getSample(id)
    if (!s) return
    set({
      code: s.code,
      activeSampleId: id,
      selectedLine: null,
      selectedYarnId: null,
      selectedOpIndex: null,
      showUpToOp: null,
      isPlaying: false,
      editorMode: 'knitout',
    })
    queueMicrotask(() => get().run())
  },
  loadCode: (code, sampleId = null) => {
    set({
      code,
      activeSampleId: sampleId,
      selectedLine: null,
      selectedYarnId: null,
      selectedOpIndex: null,
      showUpToOp: null,
      isPlaying: false,
      editorMode: 'knitout',
    })
    queueMicrotask(() => get().run())
  },
  setEditorMode: (m) => set({ editorMode: m, error: null }),
  setJsCode: (c) => set({ jsCode: c }),
  loadJsSample: (id) => {
    const s = getJsSample(id)
    if (!s) return
    set({
      jsCode: s.code,
      editorMode: 'javascript',
      activeSampleId: id,
      error: null,
    })
  },
  runJs: () => {
    const { jsCode } = get()
    set({ isRunning: true, error: null, isPlaying: false })
    const result = compileKnitoutJs(jsCode)
    if (!result.ok) {
      set({ isRunning: false, error: result.error, generatedKnitout: null })
      return
    }
    set({
      code: result.knitout,
      generatedKnitout: result.knitout,
      isRunning: false,
      selectedLine: null,
      selectedYarnId: null,
      selectedOpIndex: null,
      showUpToOp: null,
    })
    queueMicrotask(() => get().run())
  },
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
