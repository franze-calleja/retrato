import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { composeStamp } from '../render/composeStamp'
import { EXPORT_SCALE, PREVIEW_SCALE, exportFileName } from '../render/export'
import { useBooth } from '../store/booth'
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
  const { phase, celebrate, skip } = useReveal(edition.rare, reducedMotion)
  const { setValue, retake, goToPicker } = useBooth.getState()
  const template = getTemplate(templateId)
  const [print, setPrint] = useState<{ url: string; n: number } | null>(null)

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

  function startPrint() {
    // New key each time so the <img> remounts and onLoad fires even if the image is unchanged.
    setPrint((p) => ({ url: renderFull().toDataURL('image/png'), n: (p?.n ?? 0) + 1 }))
  }

  const printRoot = document.querySelector('.app')

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
        <button className="btn blue" onClick={startPrint}>Print</button>
      </div>
      <div className="row">
        <button className="btn red" onClick={retake}>Retake</button>
        <button className="btn" onClick={goToPicker}>Change card</button>
      </div>

      {print && printRoot &&
        createPortal(
          <div className="print-only">
            <img
              key={print.n}
              src={print.url}
              alt=""
              style={{ width: `${template.printSizeMm.w}mm`, height: `${template.printSizeMm.h}mm` }}
              onLoad={() => window.print()}
            />
          </div>,
          printRoot,
        )}
    </section>
  )
}
