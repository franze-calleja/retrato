import { useRef, type PointerEvent, type ReactNode } from 'react'

const MAX_TILT = 10
const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v))

export function tiltFor(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  max: number,
) {
  const px = clamp((clientX - rect.left) / rect.width - 0.5)
  const py = clamp((clientY - rect.top) / rect.height - 0.5)
  // `+ 0` normalizes -0 to 0.
  return { rx: -py * 2 * max + 0, ry: px * 2 * max + 0 }
}

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
