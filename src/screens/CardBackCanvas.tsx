import { useEffect, useRef } from 'react'
import { cardBack } from '../render/cardBack'
import type { Template } from '../templates/types'

export function CardBackCanvas({ template, scale }: { template: Template; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) cardBack(template, scale, ref.current)
  }, [template, scale])
  return <canvas ref={ref} className="stamp-canvas" aria-hidden="true" />
}
