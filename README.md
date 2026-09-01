# Knitout 3D Visualizer

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
- Live knitout editor + 3D yarn view
- **Front / back beds** separated in Z
- Loop-shaped stitches (knit vs tuck)
- **Transfer arcs** (yellow) between beds
- Course-based layout
- **Per-stitch highlighting** — cursor on a line highlights only that stitch
- Bidirectional link: click stitch → jumps to code line
- **Relax** — Laplacian smoothing for softer loops
- **Export OBJ** — download the yarn geometry
- Carrier colors + bed guides

## Default example
Cast-on → front courses → transfers to back → back knitting → transfers back → final course.

## Controls
| Button | Action |
|--------|--------|
| Run / Show | Parse code & rebuild 3D |
| Relax | Soften stitch geometry |
| Export OBJ | Download `.obj` file |
