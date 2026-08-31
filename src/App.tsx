import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei'
import Editor from '@monaco-editor/react'
import { useStore } from './store'
import { YarnPaths } from './YarnPaths'
import './App.css'

export default function App() {
  const { code, setCode, run, error, isRunning, yarnPaths } = useStore()

  useEffect(() => {
    // auto-run on first load
    run()
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="dot" />
          Knitout 3D Visualizer
          <span className="badge">MVP</span>
        </div>
        <div className="actions">
          <button className="primary" onClick={run} disabled={isRunning}>
            {isRunning ? 'Running…' : 'Run / Show'}
          </button>
          <span className="info">
            {yarnPaths.length} yarn path{yarnPaths.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className="main">
        <div className="editor-panel">
          <div className="panel-title">Knitout / JS Code</div>
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v || '')}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
          {error && <div className="error-bar">{error}</div>}
        </div>

        <div className="viewer-panel">
          <div className="panel-title">3D Yarn View</div>
          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[8, 6, 12]} fov={45} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 15, 8]} intensity={1.2} castShadow />
            <Environment preset="city" />
            <Grid
              args={[40, 40]}
              cellSize={1}
              cellThickness={0.5}
              cellColor="#2a2f3a"
              sectionSize={5}
              sectionThickness={1}
              sectionColor="#3a4050"
              fadeDistance={30}
              infiniteGrid
            />
            <YarnPaths />
          </Canvas>
        </div>
      </div>
    </div>
  )
}
