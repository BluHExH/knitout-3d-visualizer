/**
 * Lightweight knitting machine state + knitout interpreter
 * for debugging (not physical yarn simulation).
 */

export type Bed = 'f' | 'b'
export type NeedleRef = { bed: Bed; slider: boolean; n: number }

export type Loop = {
  id: string
  carrier: string
  createdByOp: number
  line: number
}

export type NeedleState = {
  hooks: Loop[]
  slider: Loop[]
}

export type MachineError = {
  severity: 'error' | 'warning'
  line: number
  opIndex: number
  message: string
  code?: string
}

export type Operation = {
  index: number
  line: number
  raw: string
  op: string
  args: string[]
  needles: string[]
  carrier?: string
}

export type MachineSnapshot = {
  needles: Record<string, NeedleState>
  carriersIn: Set<string>
  rack: number
  direction: '+' | '-' | null
  stitchNumber: number
}

export function needleKey(bed: string, n: number, slider = false): string {
  return `${bed.toLowerCase()}${slider ? 's' : ''}${n}`
}

export function parseNeedle(raw: string): NeedleRef | null {
  const m = raw?.match(/^(f|b)(s?)(-?\d+)$/i)
  if (!m) return null
  return {
    bed: m[1].toLowerCase() as Bed,
    slider: m[2] === 's',
    n: parseInt(m[3], 10),
  }
}

function emptyNeedle(): NeedleState {
  return { hooks: [], slider: [] }
}

function ensureNeedle(state: MachineSnapshot, key: string): NeedleState {
  if (!state.needles[key]) state.needles[key] = emptyNeedle()
  return state.needles[key]
}

function stack(ns: NeedleState, slider: boolean): Loop[] {
  return slider ? ns.slider : ns.hooks
}

let loopCounter = 0
function newLoop(carrier: string, opIndex: number, line: number): Loop {
  return { id: `L${++loopCounter}`, carrier, createdByOp: opIndex, line }
}

export function interpretKnitout(code: string): {
  operations: Operation[]
  errors: MachineError[]
  finalState: MachineSnapshot
  opSummaries: { opIndex: number; line: number; message: string }[]
} {
  loopCounter = 0
  const operations: Operation[] = []
  const errors: MachineError[] = []
  const opSummaries: { opIndex: number; line: number; message: string }[] = []

  const state: MachineSnapshot = {
    needles: {},
    carriersIn: new Set(),
    rack: 0,
    direction: null,
    stitchNumber: 0,
  }

  const lines = code.split('\n')
  let opIndex = 0
  let currentCarrier: string | null = null

  const err = (line: number, message: string, severity: 'error' | 'warning' = 'error') => {
    errors.push({ severity, line, opIndex, message })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = i + 1
    const raw = lines[i].trim()
    if (!raw || raw.startsWith(';')) continue

    const parts = raw.split(/\s+/)
    const op = parts[0].toLowerCase()
    const args = parts.slice(1)
    const needles: string[] = []
    let carrier: string | undefined

    const record = () => {
      operations.push({ index: opIndex, line, raw, op, args, needles: [...needles], carrier })
      opIndex++
    }

    if (op === 'inhook' || op === 'in') {
      carrier = args[0]
      if (!carrier) err(line, `${op}: missing carrier`)
      else if (state.carriersIn.has(carrier)) err(line, `Carrier ${carrier} already in`, 'warning')
      else state.carriersIn.add(carrier)
      currentCarrier = carrier || currentCarrier
      record()
      opSummaries.push({ opIndex: opIndex - 1, line, message: `in ${carrier}` })
      continue
    }

    if (op === 'outhook' || op === 'out') {
      carrier = args[0]
      if (!carrier) err(line, `${op}: missing carrier`)
      else if (!state.carriersIn.has(carrier)) err(line, `Carrier ${carrier} is not in`)
      else state.carriersIn.delete(carrier)
      if (currentCarrier === carrier) currentCarrier = null
      record()
      opSummaries.push({ opIndex: opIndex - 1, line, message: `out ${carrier}` })
      continue
    }

    if (op === 'releasehook') {
      carrier = args[0]
      record()
      opSummaries.push({ opIndex: opIndex - 1, line, message: `releasehook ${carrier || ''}` })
      continue
    }

    if (op === 'rack') {
      const r = parseFloat(args[0])
      if (Number.isNaN(r)) err(line, `rack: invalid value ${args[0]}`)
      else state.rack = r
      record()
      opSummaries.push({ opIndex: opIndex - 1, line, message: `rack ${state.rack}` })
      continue
    }

    if (op === 'xfer') {
      const from = parseNeedle(args[0])
      const to = parseNeedle(args[1])
      if (!from || !to) {
        err(line, `xfer: bad needles ${args[0]} ${args[1]}`)
        record()
        continue
      }
      const fromKey = needleKey(from.bed, from.n, from.slider)
      const toKey = needleKey(to.bed, to.n, to.slider)
      needles.push(fromKey, toKey)

      const src = ensureNeedle(state, fromKey)
      const dst = ensureNeedle(state, toKey)
      const srcStack = stack(src, from.slider)
      const dstStack = stack(dst, to.slider)

      if (srcStack.length === 0) {
        err(line, `xfer: ${fromKey} is empty`)
      } else {
        while (srcStack.length) {
          dstStack.push(srcStack.pop()!)
        }
      }
      record()
      opSummaries.push({ opIndex: opIndex - 1, line, message: `xfer ${fromKey} → ${toKey}` })
      continue
    }

    if (op === 'knit' || op === 'tuck' || op === 'miss') {
      const dir = args[0] as '+' | '-'
      const needleRaw = args[1]
      carrier = args[2] || currentCarrier || undefined
      const ref = parseNeedle(needleRaw)

      if (dir !== '+' && dir !== '-') err(line, `${op}: direction must be + or -`)
      if (!ref) err(line, `${op}: bad needle ${needleRaw}`)
      if (!carrier) err(line, `${op}: missing carrier`)
      else if (!state.carriersIn.has(carrier)) err(line, `Carrier ${carrier} is not brought in`, 'warning')

      if (ref) {
        const key = needleKey(ref.bed, ref.n, ref.slider)
        needles.push(key)
        const ns = ensureNeedle(state, key)
        const st = stack(ns, ref.slider)

        if (op === 'miss') {
          // no loop change
        } else if (op === 'tuck') {
          if (carrier) st.push(newLoop(carrier, opIndex, line))
        } else if (op === 'knit') {
          if (st.length === 0) {
            err(line, `knit on empty needle ${key}`, 'warning')
          } else {
            st.pop()
          }
          if (carrier) st.push(newLoop(carrier, opIndex, line))
        }

        state.direction = dir
      }

      record()
      opSummaries.push({
        opIndex: opIndex - 1,
        line,
        message: `${op} ${dir} ${needleRaw || ''} ${carrier || ''}`,
      })
      continue
    }

    if (op === 'drop') {
      const ref = parseNeedle(args[0])
      if (!ref) err(line, `drop: bad needle`)
      else {
        const key = needleKey(ref.bed, ref.n, ref.slider)
        needles.push(key)
        const ns = ensureNeedle(state, key)
        const st = stack(ns, ref.slider)
        if (st.length === 0) err(line, `drop: ${key} already empty`, 'warning')
        else st.length = 0
      }
      record()
      continue
    }

    if (op === 'amiss' || op === 'split') {
      err(line, `${op} is recognized but not fully simulated yet`, 'warning')
      record()
      continue
    }

    if (op === 'x-stitch-number' || op === 'x-speed-number' || op === 'x-carrier-spacing') {
      record()
      continue
    }

    err(line, `Unknown operation: ${op}`, 'warning')
    record()
  }

  for (const c of state.carriersIn) {
    errors.push({
      severity: 'warning',
      line: lines.length,
      opIndex: operations.length,
      message: `Carrier ${c} still in at end of file (missing out/outhook?)`,
    })
  }

  return { operations, errors, finalState: state, opSummaries }
}

export function occupiedNeedles(state: MachineSnapshot): {
  key: string
  bed: string
  n: number
  slider: boolean
  loops: number
  carriers: string[]
}[] {
  const out: {
    key: string
    bed: string
    n: number
    slider: boolean
    loops: number
    carriers: string[]
  }[] = []

  for (const [key, ns] of Object.entries(state.needles)) {
    for (const [slider, st] of [
      [false, ns.hooks],
      [true, ns.slider],
    ] as const) {
      if (st.length === 0) continue
      const m = key.match(/^(f|b)(s?)(-?\d+)$/)
      const bed = m?.[1] || '?'
      const n = m ? parseInt(m[3], 10) : 0
      const carriers = [...new Set(st.map((l) => l.carrier))]
      out.push({
        key: slider ? `${bed}s${n}` : key,
        bed,
        n,
        slider,
        loops: st.length,
        carriers,
      })
    }
  }

  return out.sort((a, b) => a.bed.localeCompare(b.bed) || a.n - b.n)
}
