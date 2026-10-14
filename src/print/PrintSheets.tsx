import { Fragment, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MARGIN, cutMarks, printableArea, type Page, type PaperId, type Rect } from './layout'

const PAGE_SIZE: Record<PaperId, string> = { a4: 'A4', letter: 'letter' }
const mm = (n: number) => `${n}mm`
const box = (r: Rect) => ({ left: mm(r.x), top: mm(r.y), width: mm(r.w), height: mm(r.h) })

/** Print-only pages of cards. Remount (new key) for each new job; onReady fires once all images settle. */
export function PrintSheets({ pages, paper, onReady }: { pages: Page[]; paper: PaperId; onReady?: () => void }) {
  const total = pages.reduce((n, p) => n + p.cards.length, 0)
  const settled = useRef(0)
  const ready = useRef(onReady)
  useEffect(() => {
    ready.current = onReady
  })
  useEffect(() => {
    if (total === 0) ready.current?.()
    // Mount only: a new job is a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const settle = () => {
    settled.current += 1
    if (settled.current === total) ready.current?.()
  }

  const area = printableArea(paper)
  const root = document.querySelector('.app') ?? document.body

  return createPortal(
    <div className="print-only print-sheets">
      <style>{`@page { size: ${PAGE_SIZE[paper]}; margin: ${MARGIN}mm; }`}</style>
      {pages.map((page, i) => (
        <div key={i} className="print-page" style={{ width: mm(area.w), height: mm(area.h) }}>
          {page.cards.map((c, j) => (
            <Fragment key={j}>
              <img src={c.src} alt="" style={box(c)} onLoad={settle} onError={settle} />
              {cutMarks(c).map((m, k) => (
                <span key={k} className="cut-mark" style={box(m)} />
              ))}
            </Fragment>
          ))}
        </div>
      ))}
    </div>,
    root,
  )
}
