import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useStore } from './store'
import { YarnPaths } from './YarnPaths'
import './App.css'

export default function App() {
  const {
    code,
    setCode,
    run,
    error,
    isRunning,
    yarnPaths,
    setSelectedLine,
    jumpToLine,
    setJumpToLine,
    selectedLine,
  } = useStore()

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
  const decorationIds = useRef<string[]>([])

  useEffect(() => {
    run()
  }, [])

  // When a yarn is clicked → jump Monaco to that line
  useEffect(() => {
    if (jumpToLine && editorRef.current) {
      editorRef.current.revealLineInCenter(jumpToLine)
      editorRef.current.setPosition({ lineNumber: jumpToLine, column: 1 })
      editorRef.current.focus()
      setJumpToLine(null)
    }
  }, [jumpToLine, setJumpToLine])

  // Highlight the selected line in the editor
  useEffect(() => {
    const ed = editorRef.current
    if (!ed) return

    decorationIds.current = ed.deltaDecorations(decorationIds.current, [])

    if (selectedLine !== null) {
      decorationIds.current = ed.deltaDecorations([], [
        {
          range: {
            startLineNumber: selectedLine,
            startColumn: 1,
            endLineNumber: selectedLine,
            endColumn: 999,
          },
          options: {
            isWholeLine: true,
            className: 'selected-line-highlight',
            linesDecorationsClassName: 'selected-line-gutter',
          },
        },
      ])
    }
  }, [selectedLine])

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor

    editor.onDidChangeCursorPosition((e) => {
      setSelectedLine(e.position.lineNumber)
    })
  }

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
            {selectedLine !== null && ` · line ${selectedLine}`}
          </span>
        </div>
      </header>

      <div className="main">
        <div className="editor-panel">
          <div className="panel-title">
            Knitout Code
            <span className="hint">click a line → highlights yarn · click yarn → jumps here</span>
          </div>
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v || '')}
            onMount={handleEditorMount}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              renderLineHighlight: 'all',
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
