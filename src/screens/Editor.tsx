import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { fitCount, packSheets, type Page } from '../print/layout'
import { PrintSheets } from '../print/PrintSheets'
import { composeStamp } from '../render/composeStamp'
import { EXPORT_SCALE, PREVIEW_SCALE, exportFileName } from '../render/export'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { TRAY_MAX, useTray } from '../store/tray'
import { getTemplate } from '../templates/registry'
import { SNAPSHOT_ANGLE } from '../editions/angle'
import { getEdition } from '../editions/registry'
import { TiltCard } from '../ui/TiltCard'
import { prefersReducedMotion } from '../ui/motion'
import { CardBackCanvas } from './CardBackCanvas'
import { ShimmerCard } from './ShimmerCard'
import { useReveal } from './useReveal'

export function Editor() {
  const templateId = useBooth((s) => s.templateId)
  const capture = useBooth((s) => s.capture)
  const values = useBooth((s) => s.values)
  const edition = getEdition(useBooth((s) => s.edition))
  const [reducedMotion] = useState(prefersReducedMotion)
  const revealed = useBooth((s) => s.revealed)
  const { phase, celebrate, skip } = useReveal(edition.rare, reducedMotion || revealed)
  const { setValue, retake, goToPicker } = useBooth.getState()
  const template = getTemplate(templateId)
  const paper = useOperator((s) => s.paper)
  const trayFull = useTray((s) => s.items.length >= TRAY_MAX)
  const [copies, setCopies] = useState('1')
  const [job, setJob] = useState<{ pages: Page[]; n: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(noteTimer.current), [])

  if (!capture) return null

  const renderFull = () =>
    composeStamp(template, capture, values, EXPORT_SCALE, undefined, { edition, angle: SNAPSHOT_ANGLE })

  function download() {
    renderFull().toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFileName(template.id)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  const copyCount = copies === 'fill' ? fitCount(template.printSizeMm, paper) : Number(copies)

  function flash(text: string) {
    setNote(text)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), 2000)
  }

  function startPrint() {
    const src = renderFull().toDataURL('image/png')
    const items = Array.from({ length: copyCount }, () => ({ src, ...template.printSizeMm }))
    // New key per press so the sheet remounts and waits for its own images.
    setJob((j) => ({ pages: packSheets(items, paper), n: (j?.n ?? 0) + 1 }))
  }

  function addToTray() {
    renderFull().toBlob((blob) => {
      if (!blob) return flash("Couldn't add this card")
      const url = URL.createObjectURL(blob)
      const added = useTray.getState().add({
        templateId: template.id, name: template.name, edition: edition.id, url, size: template.printSizeMm, copies: copyCount,
      })
      if (!added) URL.revokeObjectURL(url)
      flash(added ? 'Added to tray' : `Tray full (${TRAY_MAX})`)
    }, 'image/png')
  }

  return (
    <section className="screen">
      <h2>{template.name}</h2>
      <div className="reveal" data-phase={phase} onClick={phase === 'shown' ? undefined : skip}>
        <div className="reveal-card">
          <div className="reveal-face reveal-front">
            <TiltCard>
              <ShimmerCard
                template={template}
                photo={capture}
                values={values}
                edition={edition}
                scale={PREVIEW_SCALE}
                label={`Your ${edition.hasEffect ? `${edition.name.toLowerCase()} ` : ''}${template.name.toLowerCase()}`}
                live={phase === 'shown' && !reducedMotion}
              />
            </TiltCard>
          </div>
          <div className="reveal-face reveal-back">
            <CardBackCanvas template={template} scale={PREVIEW_SCALE} />
          </div>
        </div>
        {celebrate && (
          <>
            <div className="edition-banner" role="status">{edition.name.toUpperCase()}!</div>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="sparkle" style={{ '--a': `${i * 36}deg` } as CSSProperties} />
            ))}
          </>
        )}
      </div>
      {phase === 'shown' && edition.hasEffect && !celebrate && (
        <p className="edition-note">{edition.name} edition</p>
      )}

      <div className="fields">
        {template.fields.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              value={values[f.key] ?? ''}
              maxLength={f.maxLength * 2 /* emoji are 2 UTF-16 units; the store clamps by code point */}
              onChange={(e) => setValue(f.key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="row">
        <button className="btn gold" onClick={download}>Download PNG</button>
        <label className="copies">
          Copies
          <select value={copies} onChange={(e) => setCopies(e.target.value)}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
            <option value="fill">Fill page</option>
          </select>
        </label>
        <button className="btn blue" onClick={startPrint}>Print</button>
        <button className="btn green" onClick={addToTray} disabled={trayFull}>
          {trayFull ? `Tray full (${TRAY_MAX})` : 'Add to tray'}
        </button>
      </div>
      <p className="editor-note" role="status">{note}</p>
      <div className="row">
        <button className="btn red" onClick={retake}>Retake</button>
        <button className="btn" onClick={goToPicker}>Change card</button>
      </div>

      {job && <PrintSheets key={job.n} pages={job.pages} paper={paper} onReady={() => window.print()} />}
    </section>
  )
}
