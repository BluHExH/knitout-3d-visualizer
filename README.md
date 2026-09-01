# Knitout 3D Visualizer (Debug)

Interactive 3D visualizer + machine-state debugger for knitout, with yarn physics.

## Run
```bash
npm install
npm run dev
```

## Features

### Visualization & physics
- Front / back beds, loop stitches, transfer arcs
- **Spring-based yarn physics** (rest-length, self-repulsion, gravity)
- **Continuous carrier bridges** between stitches
- Auto-relax on every Run
- Per-stitch / per-op highlighting
- Export OBJ

### Machine debugging
- Loop tracking per needle
- Errors & warnings (empty knit/xfer, carrier state, …)
- Diagnostics + Needle bed + Operations panels
- **Play / Pause / Next / Prev** step-through

## Debug workflow
1. Paste knitout → **Run / Analyze** (physics applied automatically)
2. Fix Diagnostics issues
3. **Play** or step through ops
4. **Relax** again for extra smoothing
5. Check Needle bed final state
