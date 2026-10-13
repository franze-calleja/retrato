import { useEffect, useRef } from 'react'
import type { PhotoSource } from '../photo/crop'
import { composeStamp } from '../render/composeStamp'
import type { Template } from '../templates/types'

interface Props {
  template: Template
  photo: PhotoSource
  values: Record<string, string>
  scale: number
  label: string
  className?: string
}

export function StampCanvas({ template, photo, values, scale, label, className = '' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) composeStamp(template, photo, values, scale, ref.current)
  }, [template, photo, values, scale])
  return <canvas ref={ref} className={`stamp-canvas ${className}`} role="img" aria-label={label} />
}
