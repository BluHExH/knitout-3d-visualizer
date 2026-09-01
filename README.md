# Knitout 3D Visualizer (Debug)

Interactive 3D visualizer + **machine-state debugger** for knitout files.

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

## Features

### Visualization
- Front / back beds, loop stitches, transfer arcs
- Per-stitch highlighting
- Relax + Export OBJ

### Debugging (for real machine use)
- **Machine interpreter** — tracks loops on every needle
- **Errors & warnings**
  - knit on empty needle
  - xfer from empty needle
  - carrier not in / still in at end
  - bad needles / unknown ops
- **Needle bed panel** — which needles hold loops + carriers
- **Operations list** — click any op → jumps to code + highlights 3D
- Editor gutter markers for errors/warnings

## Workflow for debugging
1. Paste your knitout
2. Click **Run / Analyze**
3. Check Diagnostics panel for errors
4. Inspect Needle bed (what's left on the machine)
5. Click ops or stitches to cross-link code ↔ 3D
