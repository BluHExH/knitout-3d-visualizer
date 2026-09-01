# Knitout 3D Visualizer (Debug)

Interactive 3D visualizer + machine-state debugger for knitout.

## Run
```bash
npm install
npm run dev
```

## Features
- 3D yarn view (front/back beds, transfers, per-stitch highlight)
- Machine interpreter with loop tracking per needle
- Errors & warnings (empty knit/xfer, carrier state, etc.)
- Diagnostics + Needle bed + Operations panels
- **Step-through Play / Pause / Next / Prev**
- Relax + Export OBJ

## Debug workflow
1. Paste knitout → **Run / Analyze**
2. Fix items in **Diagnostics**
3. Use **Play** or **Next/Prev** to step through ops
4. Check **Needle bed** final state
5. Click stitches or ops to cross-link code ↔ 3D
