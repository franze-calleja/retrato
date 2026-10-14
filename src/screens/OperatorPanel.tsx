import { useEffect, useRef } from 'react'
import { editionPercents } from '../editions/odds'
import { editions } from '../editions/registry'
import { IDLE_CHOICES, useOperator } from '../store/operator'
import { useStats } from '../store/stats'

export function OperatorPanel({ onClose }: { onClose: () => void }) {
  const weights = useOperator((s) => s.weights)
  const forced = useOperator((s) => s.forced)
  const paper = useOperator((s) => s.paper)
  const idleMinutes = useOperator((s) => s.idleMinutes)
  const { setWeight, setForced, setPaper, setIdleMinutes, reset } = useOperator.getState()
  const dialogRef = useRef<HTMLDivElement>(null)
  // Close only on a press that started on the backdrop, not a slider drag released over it.
  const downOnBackdrop = useRef(false)

  function trapTab(e: KeyboardEvent) {
    const items = dialogRef.current?.querySelectorAll<HTMLElement>('input, select, button')
    if (!items?.length) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') trapTab(e)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const pct = editionPercents(weights)

  return (
    <div
      className="operator-backdrop"
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose()
        downOnBackdrop.current = false
      }}
    >
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
        <label className="operator-row">
          <span>Reset when idle</span>
          <select className="num" value={idleMinutes} onChange={(ev) => setIdleMinutes(Number(ev.target.value))}>
            {IDLE_CHOICES.map((m) => (
              <option key={m} value={m}>{m === 0 ? 'Off' : `After ${m} min`}</option>
            ))}
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
