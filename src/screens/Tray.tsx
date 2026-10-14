import { useEffect, useMemo, useRef, useState } from 'react'
import { getEdition } from '../editions/registry'
import { packSheets, printableArea, type Page, type PaperId } from '../print/layout'
import { PrintSheets } from '../print/PrintSheets'
import { useOperator } from '../store/operator'
import { MAX_COPIES, trayCopies, traySheetItems, useTray } from '../store/tray'

const pageWord = (n: number) => (n === 1 ? 'page' : 'pages')

export function TrayButton() {
  const count = useTray((s) => trayCopies(s.items))
  const open = useTray((s) => s.open)
  if (!count || open) return null
  return (
    <button className="btn gold tray-btn" onClick={useTray.getState().show}>
      Print tray (<span className="num">{count}</span>)
    </button>
  )
}

function SheetPreview({ pages, paper }: { pages: Page[]; paper: PaperId }) {
  const area = printableArea(paper)
  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  return (
    <div className="sheet-preview">
      {pages.map((p, i) => (
        <div
          key={i}
          className="sheet-mini"
          role="img"
          aria-label={`Page ${i + 1}: ${p.cards.length} cards`}
          style={{ aspectRatio: `${area.w} / ${area.h}` }}
        >
          {p.cards.map((c, j) => (
            <span
              key={j}
              style={{ left: pct(c.x, area.w), top: pct(c.y, area.h), width: pct(c.w, area.w), height: pct(c.h, area.h) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function Tray() {
  const items = useTray((s) => s.items)
  const paper = useOperator((s) => s.paper)
  const { setCopies, remove, clear, hide } = useTray.getState()
  const pages = useMemo(() => packSheets(traySheetItems(items), paper), [items, paper])
  const sheetKey = useMemo(() => JSON.stringify(pages), [pages])
  const readyFor = useRef<string | null>(null)
  const pending = useRef(false)
  const [askClear, setAskClear] = useState(false)

  useEffect(() => {
    const onAfter = () => setAskClear(true)
    window.addEventListener('afterprint', onAfter)
    return () => window.removeEventListener('afterprint', onAfter)
  }, [])

  function print() {
    if (readyFor.current === sheetKey) window.print()
    else pending.current = true
  }

  function onReady() {
    readyFor.current = sheetKey
    if (pending.current) {
      pending.current = false
      window.print()
    }
  }

  return (
    <section className="screen tray">
      <h2>Print tray</h2>
      {askClear && (
        <div className="tray-banner">
          <span>Done printing?</span>
          <button className="btn green" onClick={clear}>Clear tray</button>
          <button className="btn" onClick={() => setAskClear(false)}>Keep</button>
        </div>
      )}
      {items.length === 0 ? (
        <p>Your tray is empty</p>
      ) : (
        <ul className="tray-list">
          {items.map((i) => (
            <li key={i.id} className="tray-item">
              <img className="tray-thumb" src={i.url} alt="" />
              <span className="tray-name">{i.name} — {getEdition(i.edition).name}</span>
              <div className="stepper" role="group" aria-label={`Copies of ${i.name}`}>
                <button className="btn" aria-label="Fewer copies" disabled={i.copies <= 1} onClick={() => setCopies(i.id, i.copies - 1)}>−</button>
                <output className="num">{i.copies}</output>
                <button className="btn" aria-label="More copies" disabled={i.copies >= MAX_COPIES} onClick={() => setCopies(i.id, i.copies + 1)}>+</button>
              </div>
              <button className="btn red" onClick={() => remove(i.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <SheetPreview pages={pages} paper={paper} />
      <p data-testid="page-count"><span className="num">{pages.length}</span> {pageWord(pages.length)}</p>
      <div className="row">
        <button className="btn blue" disabled={!items.length} onClick={print}>
          {/* One span: .btn is a flex box and would drop the spaces between loose text and the number. */}
          <span>Print <span className="num">{pages.length}</span> {pageWord(pages.length)}</span>
        </button>
        <button className="btn" disabled={!items.length} onClick={clear}>Clear tray</button>
        <button className="btn gold" onClick={hide}>Back</button>
      </div>
      {pages.length > 0 && <PrintSheets key={sheetKey} pages={pages} paper={paper} onReady={onReady} />}
    </section>
  )
}
