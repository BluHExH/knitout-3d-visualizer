export type JsSample = {
  id: string
  name: string
  description: string
  code: string
}

export const JS_SAMPLES: JsSample[] = [
  {
    id: 'js-rect',
    name: 'JS: rectangle',
    description: 'Classic frontend-js style plain sheet',
    code: `// knitout-frontend-js style Writer API
const Carrier = '6'
const k = new knitout.Writer({ carriers: ['1','2','3','4','5','6','7','8','9','10'] })

k.inhook(Carrier)

// alternating tucks cast-on
for (let n = 5; n >= 0; n -= 2) k.tuck('-', 'f' + n, Carrier)
for (let n = 0; n <= 4; n += 2) k.tuck('+', 'f' + n, Carrier)

// clear the row
for (let n = 5; n >= 0; n--) k.knit('-', 'f' + n, Carrier)
k.releasehook(Carrier)

// a few plain rows
for (let r = 0; r < 4; r++) {
  if (r % 2 === 0) {
    for (let n = 0; n <= 5; n++) k.knit('+', 'f' + n, Carrier)
  } else {
    for (let n = 5; n >= 0; n--) k.knit('-', 'f' + n, Carrier)
  }
}

k.outhook(Carrier)
return k.write()
`,
  },
  {
    id: 'js-tube',
    name: 'JS: small tube',
    description: 'Front + back circular tube via xfer',
    code: `const C = '8'
const k = new knitout.Writer({ carriers: ['1','2','3','4','5','6','7','8','9','10'] })
k.comment('small tube')
k.inhook(C)
for (let n = 3; n >= 0; n -= 2) k.tuck('-', 'f' + n, C)
for (let n = 0; n <= 2; n += 2) k.tuck('+', 'f' + n, C)
for (let n = 3; n >= 0; n--) k.knit('-', 'f' + n, C)
k.releasehook(C)

for (let n = 0; n <= 3; n++) k.xfer('f' + n, 'b' + n)

for (let r = 0; r < 3; r++) {
  for (let n = 0; n <= 3; n++) k.knit('+', 'b' + n, C)
  for (let n = 3; n >= 0; n--) k.knit('-', 'f' + n, C)
}
k.outhook(C)
return k.write()
`,
  },
  {
    id: 'js-rib',
    name: 'JS: 1x1 rib setup',
    description: 'Transfer odd needles to back, then knit rib',
    code: `const C = '4'
const k = new knitout.Writer({ carriers: ['1','2','3','4','5','6','7','8','9','10'] })
k.inhook(C)
for (let n = 7; n >= 0; n -= 2) k.tuck('-', 'f' + n, C)
for (let n = 0; n <= 6; n += 2) k.tuck('+', 'f' + n, C)
for (let n = 7; n >= 0; n--) k.knit('-', 'f' + n, C)
k.releasehook(C)

for (let n = 1; n <= 7; n += 2) k.xfer('f' + n, 'b' + n)

for (let r = 0; r < 3; r++) {
  for (let n = 0; n <= 7; n++) {
    if (n % 2 === 0) k.knit('+', 'f' + n, C)
    else k.knit('+', 'b' + n, C)
  }
  for (let n = 7; n >= 0; n--) {
    if (n % 2 === 0) k.knit('-', 'f' + n, C)
    else k.knit('-', 'b' + n, C)
  }
}
k.outhook(C)
return k.write()
`,
  },
]

export function getJsSample(id: string) {
  return JS_SAMPLES.find((s) => s.id === id)
}
