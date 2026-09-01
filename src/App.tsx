import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useStore } from './store'
import { YarnPaths } from './YarnPaths'
import { DebugPanel } from './DebugPanel'
import './App.css'

export default function App() {
  const {
    code, setCode, run, relax, exportOBJ, error, isRunning, yarnPaths,
    setSelectedLine, jumpToLine, setJumpToLine, selectedLine, relaxed, errors,
    isPlaying, play, pause, stepNext, stepPrev, stopPlay, selectedOpIndex, operations,
  } = useStore()

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const decorationIds = useRef<string[]>([])
  const errorDecorationIds = useRef<string[]>([])

  useEffect(() => { run() }, [])

  useEffect(() => {
    if (jumpToLine && editorRef.current) {
      editorRef.current.revealLineInCenter(jumpToLine)
      editorRef.current.setPosition({ lineNumber: jumpToLine, column: 1 })
      editorRef.current.focus()
      setJumpToLine(null)
    }
  }, [jumpToLine, setJumpToLine])

  useEffect(() => {
    const ed = editorRef.current
    if (!ed) return
    decorationIds.current = ed.deltaDecorations(decorationIds.current, [])
    if (selectedLine !== null) {
      decorationIds.current = ed.deltaDecorations([], [{
        range: { startLineNumber: selectedLine, startColumn: 1, endLineNumber: selectedLine, endColumn: 999 },
        options: { isWholeLine: true, className: 'selected-line-highlight', linesDecorationsClassName: 'selected-line-gutter' },
      }])
    }
  }, [selectedLine])

  useEffect(() => {
    const ed = editorRef.current
    if (!ed) return
    errorDecorationIds.current = ed.deltaDecorations(
      errorDecorationIds.current,
      errors.map((e) => ({
        range: { startLineNumber: e.line, startColumn: 1, endLineNumber: e.line, endColumn: 1 },
        options: {
          isWholeLine: false,
          glyphMarginClassName: e.severity === 'error' ? 'glyph-error' : 'glyph-warn',
          overviewRuler: { color: e.severity === 'error' ? '#f87171' : '#fbbf24', position: 1 },
        },
      }))
    )
  }, [errors])

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.onDidChangeCursorPosition((e) => setSelectedLine(e.position.lineNumber))
  }

  const errN = errors.filter((e) => e.severity === 'error').length
  const warnN = errors.filter((e) => e.severity === 'warning').length

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="dot" />
          Knitout 3D Visualizer
          <span className="badge">debug</span>
        </div>
        <div className="actions">
          <button className="primary" onClick={run} disabled={isRunning}>
            {isRunning ? 'Running…' : 'Run / Analyze'}
          </button>
          <button onClick={relax} disabled={yarnPaths.length === 0}>{relaxed ? 'Relaxed ✓' : 'Relax'}</button>
          <button onClick={exportOBJ} disabled={yarnPaths.length === 0}>Export OBJ</button>
          <span className="sep" />
          <button onClick={stepPrev} disabled={!operations.length}>‹ Prev</button>
          {isPlaying ? (
            <button className="primary" onClick={pause}>Pause</button>
          ) : (
            <button className="primary" onClick={play} disabled={!operations.length}>Play</button>
          )}
          <button onClick={stepNext} disabled={!operations.length}>Next ›</button>
          <button onClick={stopPlay} disabled={selectedOpIndex === null && !isPlaying}>Stop</button>
          <span className="info">
            {yarnPaths.length} stitches
            {errN > 0 && <span className="info-err"> · {errN} errors</span>}
            {warnN > 0 && <span className="info-warn"> · {warnN} warnings</span>}
            {selectedLine !== null && ` · L${selectedLine}`}
            {selectedOpIndex !== null && ` · op ${selectedOpIndex}`}
          </span>
        </div>
      </header>

      <div className="main">
        <div className="editor-panel">
          <div className="panel-title">
            Knitout Code
            <span className="hint">errors marked in gutter</span>
          </div>
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v || '')}
            onMount={handleEditorMount}
            options={{
              fontSize: 13, minimap: { enabled: false }, lineNumbers: 'on', glyphMargin: true,
              scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true, renderLineHighlight: 'all',
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
            <Grid args={[40, 40]} cellSize={1} cellThickness={0.5} cellColor="#2a2f3a"
              sectionSize={5} sectionThickness={1} sectionColor="#3a4050" fadeDistance={30} infiniteGrid />
            <YarnPaths />
          </Canvas>
        </div>

        <DebugPanel />
      </div>
    </div>
  )
}
