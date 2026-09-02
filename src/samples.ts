export type KnitoutSample = {
  id: string
  name: string
  description: string
  code: string
}

export const SAMPLES: KnitoutSample[] = [
  {
    id: 'multi-carrier',
    name: 'Multi-carrier + xfer',
    description: 'Blue then teal, 8 needles, transfer band',
    code: `;!knitout-2
;;Carriers: 1 2 3 4 5 6 7 8 9 10
;; multi-carrier sample: blue(7) then teal(5)
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
`,
  },
  {
    id: 'plain-sheet',
    name: 'Plain sheet',
    description: 'Simple stockinette on front bed',
    code: `;!knitout-2
;;Carriers: 1 2 3 4 5 6 7 8 9 10
inhook 6
tuck - f5 6
tuck - f3 6
tuck - f1 6
tuck + f0 6
tuck + f2 6
tuck + f4 6
knit - f5 6
knit - f4 6
knit - f3 6
knit - f2 6
knit - f1 6
knit - f0 6
releasehook 6
knit + f0 6
knit + f1 6
knit + f2 6
knit + f3 6
knit + f4 6
knit + f5 6
knit - f5 6
knit - f4 6
knit - f3 6
knit - f2 6
knit - f1 6
knit - f0 6
knit + f0 6
knit + f1 6
knit + f2 6
knit + f3 6
knit + f4 6
knit + f5 6
knit - f5 6
knit - f4 6
knit - f3 6
knit - f2 6
knit - f1 6
knit - f0 6
outhook 6
`,
  },
  {
    id: 'rib-2x2',
    name: '2×2 rib setup',
    description: 'Front/back alternate needles (xfer rib)',
    code: `;!knitout-2
;;Carriers: 1 2 3 4 5 6 7 8 9 10
inhook 4
tuck - f7 4
tuck - f5 4
tuck - f3 4
tuck - f1 4
tuck + f0 4
tuck + f2 4
tuck + f4 4
tuck + f6 4
knit - f7 4
knit - f6 4
knit - f5 4
knit - f4 4
knit - f3 4
knit - f2 4
knit - f1 4
knit - f0 4
releasehook 4
xfer f1 b1
xfer f3 b3
xfer f5 b5
xfer f7 b7
knit + f0 4
knit + b1 4
knit + f2 4
knit + b3 4
knit + f4 4
knit + b5 4
knit + f6 4
knit + b7 4
knit - b7 4
knit - f6 4
knit - b5 4
knit - f4 4
knit - b3 4
knit - f2 4
knit - b1 4
knit - f0 4
knit + f0 4
knit + b1 4
knit + f2 4
knit + b3 4
knit + f4 4
knit + b5 4
knit + f6 4
knit + b7 4
outhook 4
`,
  },
  {
    id: 'tube',
    name: 'Small tube',
    description: 'Circular knitting front then back',
    code: `;!knitout-2
;;Carriers: 1 2 3 4 5 6 7 8 9 10
inhook 8
tuck - f3 8
tuck - f1 8
tuck + f0 8
tuck + f2 8
knit - f3 8
knit - f2 8
knit - f1 8
knit - f0 8
releasehook 8
xfer f0 b0
xfer f1 b1
xfer f2 b2
xfer f3 b3
knit + b0 8
knit + b1 8
knit + b2 8
knit + b3 8
knit - f3 8
knit - f2 8
knit - f1 8
knit - f0 8
knit + b0 8
knit + b1 8
knit + b2 8
knit + b3 8
knit - f3 8
knit - f2 8
knit - f1 8
knit - f0 8
outhook 8
`,
  },
  {
    id: 'tiny-debug',
    name: 'Tiny debug',
    description: '4 stitches — fast step-through',
    code: `;!knitout-2
;;Carriers: 1 2 3 4 5 6 7 8 9 10
inhook 7
tuck - f1 7
tuck + f0 7
knit - f1 7
knit - f0 7
releasehook 7
knit + f0 7
knit + f1 7
knit - f1 7
knit - f0 7
outhook 7
`,
  },
]

export function getSample(id: string): KnitoutSample | undefined {
  return SAMPLES.find((s) => s.id === id)
}
