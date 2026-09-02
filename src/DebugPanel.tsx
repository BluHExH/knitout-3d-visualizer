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
  const yarnRadius = useStore((s) => s.yarnRadius)
  const setYarnRadius = useStore((s) => s.setYarnRadius)
  const courseOffset = useStore((s) => s.courseOffset)
  const setCourseOffset = useStore((s) => s.setCourseOffset)
  const gauge = useStore((s) => s.gauge)
  const setGauge = useStore((s) => s.setGauge)
  const showNeedleLabels = useStore((s) => s.showNeedleLabels)
  const setShowNeedleLabels = useStore((s) => s.setShowNeedleLabels)
  const run = useStore((s) => s.run)

  const errorCount = errors.filter((e) => e.severity === 'error').length
  const warnCount = errors.filter((e) => e.severity === 'warning').length

  const selectOp = (index: number, line: number) => {
    setSelectedOpIndex(index)
    setSelectedLine(line)
    setJumpToLine(line)
    setShowUpToOp(index)
  }

  return (
    <aside className="debug-panel">
      <section className="debug-section compact">
        <div className="debug-title">
          View filters
          <span className="debug-meta">playback</span>
        </div>
        <div className="debug-body">
          <label className="toggle">
            <input type="checkbox" checked={ghostPast} onChange={(e) => setGhostPast(e.target.checked)} />
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
            type="button"
            className="debug-btn"
            onClick={() => {
              setShowUpToOp(null)
              setSelectedOpIndex(null)
            }}
            disabled={showUpToOp === null}
          >
            Show all ops
          </button>
        </div>
      </section>

      <section className="debug-section compact">
        <div className="debug-title">
          Geometry
          <span className="debug-meta">rebuild after change</span>
        </div>
        <div className="debug-body">
          <label className="toggle">
            <input
              type="checkbox"
              checked={courseOffset}
              onChange={(e) => setCourseOffset(e.target.checked)}
            />
            Course offset
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showNeedleLabels}
              onChange={(e) => setShowNeedleLabels(e.target.checked)}
            />
            Needle labels
          </label>

          <div className="slider-block">
            <div className="slider-head">
              <span>Yarn thickness</span>
              <span className="slider-val">{yarnRadius.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.6}
              step={0.05}
              value={yarnRadius}
              onChange={(e) => setYarnRadius(parseFloat(e.target.value))}
            />
          </div>

          <div className="slider-block">
            <div className="slider-head">
              <span>Gauge (spacing)</span>
              <span className="slider-val">{gauge.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.5}
              step={0.05}
              value={gauge}
              onChange={(e) => setGauge(parseFloat(e.target.value))}
            />
          </div>

          <button type="button" className="debug-btn primary-ish" onClick={() => run()}>
            Rebuild geometry
          </button>
        </div>
      </section>

      <section className="debug-section scrollable">
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
              type="button"
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
      </section>

      <section className="debug-section scrollable">
        <div className="debug-title">
          Needle bed
          <span className="debug-meta">
            rack {finalState?.rack ?? 0} · {occupied.length} occ
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
      </section>

      <section className="debug-section grow">
        <div className="debug-title">
          Operations
          <span className="debug-meta">
            {operations.length}
            {showUpToOp !== null ? ` · ≤${showUpToOp}` : ''}
          </span>
        </div>
        <div className="debug-list ops">
          {operations.length === 0 && <div className="debug-empty">Run to list ops</div>}
          {operations.map((op) => (
            <button
              key={op.index}
              type="button"
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
      </section>
    </aside>
  )
}
