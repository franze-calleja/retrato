import { useEffect, useRef } from 'react'
import { SNAPSHOT_ANGLE, angleFor, driftAngle } from '../editions/angle'
import type { Edition } from '../editions/types'
import type { PhotoSource } from '../photo/crop'
import { composeStamp } from '../render/composeStamp'
import type { Template } from '../templates/types'

interface Props {
  template: Template
  photo: PhotoSource
  values: Record<string, string>
  edition: Edition
  scale: number
  label: string
  /** Animate the shimmer (pointer-follow + idle drift). */
  live: boolean
}

export function ShimmerCard({ template, photo, values, edition, scale, label, live }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const pointer = useRef<number | null>(null)
  const animate = live && edition.hasEffect

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = (angle: number) => composeStamp(template, photo, values, scale, canvas, { edition, angle })
    if (!animate) {
      draw(SNAPSHOT_ANGLE)
      return
    }
    // requestAnimationFrame pauses on hidden tabs, so the drift stops there too.
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      draw(pointer.current ?? driftAngle(now - t0))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [template, photo, values, edition, scale, animate])

  return (
    <div
      onPointerMove={(e) => {
        pointer.current = angleFor(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
      }}
      onPointerLeave={() => {
        pointer.current = null
      }}
    >
      <canvas ref={ref} className="stamp-canvas" role="img" aria-label={label} />
    </div>
  )
}
