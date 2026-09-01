import { useStore } from './store'

export function DebugPanel() {
  const errors = useStore((s) => s.errors)
  const occupied = useStore((s) => s.occupied)
  const operations = useStore((s) => s.operations)
  const finalState = useStore((s) => s.finalState)
  const selectedOpIndex = useStore((s) => s.selectedOpIndex)
  const showUpToOp = useStore((s) => s.showUpToOp)
  const ghostPast = useStore((s) => s.ghostPast)
  const highlightCurrentOnly = useStore((s) => s.highlightCurrentOnly)
  const setSelectedLine = useStore((s) => s.setSelectedLine)
  const setJumpToLine = useStore((s) => s.setJumpToLine)
  const setSelectedOpIndex = useStore((s) => s.setSelectedOpIndex)
  const setShowUpToOp = useStore((s) => s.setShowUpToOp)
  const setGhostPast = useStore((s) => s.setGhostPast)
  const setHighlightCurrentOnly = useStore((s) => s.setHighlightCurrentOnly)

  const errorCount = errors.filter((e) => e.severity === 'error').length
  const warnCount = errors.filter((e) => e.severity === 'warning').length

  const selectOp = (index: number, line: number) => {
    setSelectedOpIndex(index)
    setSelectedLine(line)
    setJumpToLine(line)
    setShowUpToOp(index)
  }

  return (
    <div className="debug-panel">
      <div className="debug-section">
        <div className="debug-title">
          View
          <span className="debug-meta">debug filters</span>
        </div>
        <div className="debug-toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={ghostPast}
              onChange={(e) => setGhostPast(e.target.checked)}
            />
            Ghost past ops
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={highlightCurrentOnly}
              onChange={(e) => setHighlightCurrentOnly(e.target.checked)}
            />
            Dim non-current
          </label>
          <button
            className="debug-clear"
            onClick={() => {
              setShowUpToOp(null)
              setSelectedOpIndex(null)
            }}
            disabled={showUpToOp === null}
          >
            Show all ops
          </button>
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-title">
          Diagnostics
          <span className="debug-badges">
            {errorCount > 0 && <span className="badge-err">{errorCount} err</span>}
            {warnCount > 0 && <span className="badge-warn">{warnCount} warn</span>}
            {errorCount === 0 && warnCount === 0 && <span className="badge-ok">clean</span>}
          </span>
        </div>
        <div className="debug-list">
          {errors.length === 0 && <div className="debug-empty">No errors or warnings</div>}
          {errors.map((e, i) => (
            <button
              key={i}
              className={`debug-item ${e.severity}`}
              onClick={() => {
                setSelectedLine(e.line)
                setJumpToLine(e.line)
              }}
            >
              <span className="sev">{e.severity === 'error' ? 'E' : 'W'}</span>
              <span className="msg">
                L{e.line}: {e.message}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-title">
          Needle bed
          <span className="debug-meta">
            rack {finalState?.rack ?? 0} · {occupied.length} occupied
          </span>
        </div>
        <div className="debug-list needles">
          {occupied.length === 0 && <div className="debug-empty">All needles empty</div>}
          {occupied.map((n) => (
            <div key={n.key} className="needle-row">
              <span className="nkey">{n.key}</span>
              <span className="nloops">
                {n.loops} loop{n.loops !== 1 ? 's' : ''}
              </span>
              <span className="ncar">{n.carriers.join(',')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="debug-section grow">
        <div className="debug-title">
          Operations
          <span className="debug-meta">
            {operations.length}
            {showUpToOp !== null ? ` · showing ≤ ${showUpToOp}` : ''}
          </span>
        </div>
        <div className="debug-list ops">
          {operations.map((op) => (
            <button
              key={op.index}
              className={`debug-item op ${selectedOpIndex === op.index ? 'active' : ''} ${
                showUpToOp !== null && op.index > showUpToOp ? 'dim' : ''
              }`}
              onClick={() => selectOp(op.index, op.line)}
            >
              <span className="opidx">{op.index}</span>
              <span className="msg">
                L{op.line} {op.raw}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
