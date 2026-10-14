import { useEffect, useRef } from 'react'
import { editionPercents } from '../editions/odds'
import { editions } from '../editions/registry'
import { useOperator } from '../store/operator'
import { useStats } from '../store/stats'

export function OperatorPanel({ onClose }: { onClose: () => void }) {
  const weights = useOperator((s) => s.weights)
  const forced = useOperator((s) => s.forced)
  const paper = useOperator((s) => s.paper)
  const { setWeight, setForced, setPaper, reset } = useOperator.getState()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const pct = editionPercents(weights)

  return (
    <div className="operator-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="operator-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operator-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="operator-title">Operator settings</h2>
        {editions.map((e) => (
          <label key={e.id} className="operator-row">
            <span>{e.name}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[e.id] ?? 0}
              onChange={(ev) => setWeight(e.id, Number(ev.target.value))}
            />
            <output className="num" data-testid={`pct-${e.id}`}>{pct[e.id]}%</output>
          </label>
        ))}
        <label className="operator-row">
          <span>Force edition</span>
          <select value={forced} onChange={(ev) => setForced(ev.target.value)}>
            <option value="random">Random</option>
            {editions.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="operator-row">
          <span>Paper</span>
          <select value={paper} onChange={(ev) => setPaper(ev.target.value)}>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </label>
        <div className="row">
          <button className="btn" onClick={reset}>Reset to defaults</button>
          <button className="btn" onClick={() => useStats.getState().resetPhotos()}>Reset photo counter</button>
          <button className="btn gold" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
