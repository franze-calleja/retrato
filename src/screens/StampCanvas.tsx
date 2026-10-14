import { useEffect, useRef } from 'react'
import { SNAPSHOT_ANGLE } from '../editions/angle'
import type { Edition } from '../editions/types'
import type { PhotoSource } from '../photo/crop'
import { composeStamp } from '../render/composeStamp'
import type { Template } from '../templates/types'

interface Props {
  template: Template
  photo: PhotoSource
  values: Record<string, string>
  scale: number
  /** Omit when a surrounding control already names the card; the canvas is then hidden from assistive tech. */
  label?: string
  className?: string
  /** Static edition snapshot (no animation). */
  edition?: Edition
}

export function StampCanvas({ template, photo, values, scale, label, className = '', edition }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) composeStamp(template, photo, values, scale, ref.current, { edition, angle: SNAPSHOT_ANGLE })
  }, [template, photo, values, scale, edition])
  return label ? (
    <canvas ref={ref} className={`stamp-canvas ${className}`} role="img" aria-label={label} />
  ) : (
    <canvas ref={ref} className={`stamp-canvas ${className}`} aria-hidden="true" />
  )
}
