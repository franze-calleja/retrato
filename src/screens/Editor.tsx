import { useState } from 'react'
import { createPortal } from 'react-dom'
import { composeStamp } from '../render/composeStamp'
import { EXPORT_SCALE, PREVIEW_SCALE, exportFileName } from '../render/export'
import { useBooth } from '../store/booth'
import { getTemplate } from '../templates/registry'
import { StampCanvas } from './StampCanvas'

export function Editor() {
  const templateId = useBooth((s) => s.templateId)
  const capture = useBooth((s) => s.capture)
  const values = useBooth((s) => s.values)
  const { setValue, retake, goToPicker } = useBooth.getState()
  const template = getTemplate(templateId)
  const [print, setPrint] = useState<{ url: string; n: number } | null>(null)

  if (!capture) return null

  const renderFull = () => composeStamp(template, capture, values, EXPORT_SCALE)

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
      <div className="preview-wrap">
        <StampCanvas
          className="pop-in"
          template={template}
          photo={capture}
          values={values}
          scale={PREVIEW_SCALE}
          label={`Your ${template.name.toLowerCase()}`}
        />
      </div>

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
