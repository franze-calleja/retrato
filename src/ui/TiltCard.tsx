import { useRef, type PointerEvent, type ReactNode } from 'react'
import { tiltFor } from './tilt'

const MAX_TILT = 10

export function TiltCard({ children, delay = 0, motion = 'bob' }: { children: ReactNode; delay?: number; motion?: 'bob' | 'sway' }) {
  const ref = useRef<HTMLDivElement>(null)

  function set(rx: number, ry: number) {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
    // Unitless copies for shadows and glare (calc cannot turn degrees into pixels).
    el.style.setProperty('--tilt-x', String(ry))
    el.style.setProperty('--tilt-y', String(rx))
  }

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const { rx, ry } = tiltFor(e.clientX, e.clientY, el.getBoundingClientRect(), MAX_TILT)
    set(rx, ry)
  }

  return (
    <div ref={ref} className="tilt" onPointerMove={onMove} onPointerLeave={() => set(0, 0)}>
      <div className={`tilt-inner ${motion === 'sway' ? 'sway' : ''}`} style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </div>
  )
}
