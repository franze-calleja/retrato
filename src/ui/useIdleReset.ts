import { useEffect, useRef } from 'react'

const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/** Calls onIdle after `minutes` with no touch, click, scroll or key. 0 or paused = off. */
export function useIdleReset(minutes: number, onIdle: () => void, paused: boolean) {
  const latest = useRef(onIdle)
  useEffect(() => {
    latest.current = onIdle
  })

  useEffect(() => {
    if (paused || minutes <= 0) return
    let timer: ReturnType<typeof setTimeout>
    const restart = () => {
      clearTimeout(timer)
      timer = setTimeout(() => latest.current(), minutes * 60_000)
    }
    restart()
    for (const type of ACTIVITY) window.addEventListener(type, restart, { capture: true, passive: true })
    return () => {
      clearTimeout(timer)
      for (const type of ACTIVITY) window.removeEventListener(type, restart, { capture: true })
    }
  }, [minutes, paused])
}
