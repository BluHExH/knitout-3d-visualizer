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
