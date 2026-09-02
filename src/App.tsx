import { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { useStore } from './store'
import { YarnPaths } from './YarnPaths'
import { DebugPanel } from './DebugPanel'
import { SAMPLES } from './samples'
import { JS_SAMPLES } from './jsSamples'
import './App.css'

export default function App() {
  const {
    code, setCode, run, relax, exportOBJ, error, isRunning, yarnPaths,
    setSelectedLine, jumpToLine, setJumpToLine, selectedLine, relaxed, errors,
    isPlaying, play, pause, stepNext, stepPrev, stopPlay, selectedOpIndex, operations,
    loadSample, loadCode, activeSampleId,
    editorMode, setEditorMode, jsCode, setJsCode, loadJsSample, runJs, generatedKnitout,
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
          <span className="logo-text">Knitout 3D</span>
          <span className="badge">visualizer</span>
        </div>

        <div className="actions">
          <div className="btn-group mode-group" role="group" aria-label="Editor mode">
            <button type="button" className={editorMode === 'knitout' ? 'primary' : ''} onClick={() => setEditorMode('knitout')}>Knitout</button>
            <button type="button" className={editorMode === 'javascript' ? 'primary' : ''} onClick={() => setEditorMode('javascript')}>JS Writer</button>
          </div>

          <div className="btn-group samples-group" role="group" aria-label="Samples">
            <label className="sample-label" htmlFor="sample-select">Sample</label>
            {editorMode === 'knitout' ? (
              <>
                <select id="sample-select" className="sample-select" value={activeSampleId ?? ''} onChange={(e) => { const id = e.target.value; if (id) loadSample(id) }} title="Load knitout sample">
                  <option value="" disabled={!!activeSampleId}>{activeSampleId ? 'Custom / edited' : 'Choose sample…'}</option>
                  {SAMPLES.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
                <label className="file-btn" title="Open .k / .knitout file">
                  Open file
                  <input type="file" accept=".k,.knitout,.txt,text/plain" hidden onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const reader = new FileReader()
                    reader.onload = () => loadCode(String(reader.result || ''), null)
                    reader.readAsText(f)
                    e.target.value = ''
                  }} />
                </label>
              </>
            ) : (
              <select id="sample-select" className="sample-select" value={activeSampleId && JS_SAMPLES.some((s) => s.id === activeSampleId) ? activeSampleId : JS_SAMPLES[0].id} onChange={(e) => { const id = e.target.value; if (id) loadJsSample(id) }} title="Load JS Writer sample">
                {JS_SAMPLES.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            )}
          </div>

          <div className="btn-group" role="group" aria-label="Analyze">
            {editorMode === 'javascript' ? (
              <button className="primary" onClick={runJs} disabled={isRunning} title="Compile JS Writer → knitout → 3D">{isRunning ? 'Compiling…' : 'Compile & Run'}</button>
            ) : (
              <button className="primary" onClick={run} disabled={isRunning} title="Parse, simulate, and build 3D">{isRunning ? 'Running…' : 'Run'}</button>
            )}
            <button onClick={relax} disabled={yarnPaths.length === 0} title="Extra physics iterations">{relaxed ? 'Relaxed ✓' : 'Relax'}</button>
            <button onClick={exportOBJ} disabled={yarnPaths.length === 0} title="Download OBJ">Export</button>
          </div>

          <div className="btn-group" role="group" aria-label="Playback">
            <button onClick={stepPrev} disabled={!operations.length} title="Previous operation">‹ Prev</button>
            {isPlaying ? (
              <button className="primary" onClick={pause} title="Pause playback">Pause</button>
            ) : (
              <button className="primary" onClick={play} disabled={!operations.length} title="Step through ops">Play</button>
            )}
            <button onClick={stepNext} disabled={!operations.length} title="Next operation">Next ›</button>
            <button className="ghost" onClick={stopPlay} disabled={selectedOpIndex === null && !isPlaying} title="Clear step selection">Stop</button>
          </div>

          <div className="status-pill">
            <span className="status-item"><span className="status-label">stitches</span><span className="status-val">{yarnPaths.length}</span></span>
            {errN > 0 && (<span className="status-item err"><span className="status-label">errors</span><span className="status-val">{errN}</span></span>)}
            {warnN > 0 && (<span className="status-item warn"><span className="status-label">warn</span><span className="status-val">{warnN}</span></span>)}
            {selectedLine !== null && (<span className="status-item"><span className="status-label">line</span><span className="status-val">L{selectedLine}</span></span>)}
            {selectedOpIndex !== null && (<span className="status-item"><span className="status-label">op</span><span className="status-val">{selectedOpIndex}</span></span>)}
          </div>
        </div>
      </header>

      <div className="main">
        <div className="editor-panel">
          <div className="panel-title">
            {editorMode === 'javascript' ? 'JS Writer' : 'Knitout Code'}
            <span className="hint">{editorMode === 'javascript' ? 'new knitout.Writer → return k.write()' : 'errors marked in gutter'}</span>
          </div>
          {editorMode === 'javascript' ? (
            <Editor height="100%" defaultLanguage="javascript" language="javascript" theme="vs-dark" value={jsCode} onChange={(v) => setJsCode(v || '')} options={{ fontSize: 13, minimap: { enabled: false }, lineNumbers: 'on', glyphMargin: true, scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true, renderLineHighlight: 'all', tabSize: 2 }} />
          ) : (
            <Editor height="100%" defaultLanguage="plaintext" language="plaintext" theme="vs-dark" value={code} onChange={(v) => setCode(v || '')} onMount={handleEditorMount} options={{ fontSize: 13, minimap: { enabled: false }, lineNumbers: 'on', glyphMargin: true, scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true, renderLineHighlight: 'all' }} />
          )}
          {editorMode === 'javascript' && generatedKnitout && (
            <div className="generated-bar">
              Generated knitout · {generatedKnitout.split('\n').filter(Boolean).length} lines
              <button type="button" className="linkish" onClick={() => setEditorMode('knitout')}>View knitout</button>
            </div>
          )}
          {error && <div className="error-bar">{error}</div>}
        </div>

        <div className="viewer-panel">
          <div className="panel-title">3D Yarn View</div>
          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[12, 8, 16]} fov={45} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
            <ambientLight intensity={0.55} />
            <directionalLight position={[10, 15, 8]} intensity={1.35} castShadow shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-6, 8, -4]} intensity={0.35} />
            <Environment preset="city" />
            <Grid args={[40, 40]} cellSize={1} cellThickness={0.5} cellColor="#2a2f3a" sectionSize={5} sectionThickness={1} sectionColor="#3a4050" fadeDistance={30} infiniteGrid />
            <YarnPaths />
          </Canvas>
        </div>

        <DebugPanel />
      </div>
    </div>
  )
}
