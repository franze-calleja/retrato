import { useEffect, useRef } from 'react'

const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'afterprint'] as const

/** Calls onIdle after `minutes` with no touch, pointer, scroll or key. Paused while printing; 0 or paused = off. */
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
    // The print dialog can outlast the idle time; never reset the booth behind it or as it closes.
    const pause = () => clearTimeout(timer)
    restart()
    for (const type of ACTIVITY) window.addEventListener(type, restart, { capture: true, passive: true })
    window.addEventListener('beforeprint', pause)
    return () => {
      clearTimeout(timer)
      for (const type of ACTIVITY) window.removeEventListener(type, restart, { capture: true })
      window.removeEventListener('beforeprint', pause)
    }
  }, [minutes, paused])
}
