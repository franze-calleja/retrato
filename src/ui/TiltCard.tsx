import { useRef, type PointerEvent, type ReactNode } from 'react'
import { tiltFor } from './tilt'

const MAX_TILT = 10

export function TiltCard({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const { rx, ry } = tiltFor(e.clientX, e.clientY, el.getBoundingClientRect(), MAX_TILT)
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
  }

  function onLeave() {
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }

  return (
    <div ref={ref} className="tilt" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="tilt-inner" style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </div>
  )
}
