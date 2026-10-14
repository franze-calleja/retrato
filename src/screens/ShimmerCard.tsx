import { useEffect, useRef } from 'react'
import { SNAPSHOT_ANGLE, angleFor, driftAngle, quantizeAngle } from '../editions/angle'
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
  // Latest inputs for the animation loop, so typing redraws without restarting the drift.
  const inputs = useRef({ template, photo, values, edition, scale })
  const drawn = useRef<{ angle: number; inputs: unknown } | null>(null)
  const t0 = useRef<number | null>(null)

  useEffect(() => {
    inputs.current = { template, photo, values, edition, scale }
    if (animate || !ref.current) return
    composeStamp(template, photo, values, scale, ref.current, { edition, angle: SNAPSHOT_ANGLE })
  }, [template, photo, values, edition, scale, animate])

  useEffect(() => {
    if (!animate) return
    t0.current ??= performance.now()
    drawn.current = null
    // requestAnimationFrame pauses on hidden tabs, so the drift stops there too.
    let raf = 0
    const tick = (now: number) => {
      const canvas = ref.current
      const angle = quantizeAngle(pointer.current ?? driftAngle(now - (t0.current ?? now)))
      const cur = inputs.current
      // Only redraw when the shimmer step or the card itself changed.
      if (canvas && (drawn.current?.angle !== angle || drawn.current.inputs !== cur)) {
        composeStamp(cur.template, cur.photo, cur.values, cur.scale, canvas, { edition: cur.edition, angle })
        drawn.current = { angle, inputs: cur }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate])

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
