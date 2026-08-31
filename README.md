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

## Features (current MVP)
- Load / edit knitout code
- Basic yarn path generation from knit/tuck
- 3D tube rendering of yarns
- Carrier colors
- Orbit controls

## Next steps
- Better stitch topology (front/back bed, transfers)
- Bidirectional highlighting (code line ↔ yarn segment)
- Simple relaxation / physics
- Full knitout operation support
- Export OBJ / GLTF
