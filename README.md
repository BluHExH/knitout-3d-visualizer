# Knitout 3D Visualizer (MVP)

Interactive 3D visualizer for knitout files with live code editing.

## Stack
- React 19 + TypeScript
- React Three Fiber + Three.js + Drei
- Monaco Editor
- Zustand

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features
- Load / edit knitout code
- **Improved stitch topology**: front & back beds separated in Z
- Proper loop-shaped stitches (knit vs tuck)
- **Transfer arcs** (yellow) between beds
- Course-based layout (direction change advances Y)
- Carrier colors
- Orbit controls + bed guides
- **Bidirectional highlighting**: click a code line → yarn lights up; click a yarn → jumps to the source line

## Default example
Includes cast-on, front courses, transfers to back bed, back knitting, and transfers back to front.

## Next steps
- Per-stitch (not just per-path) highlighting
- Simple yarn relaxation / physics
- More operations (split, drop, etc.)
- Export OBJ / GLTF
