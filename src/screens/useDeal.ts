import { useCallback, useEffect, useState } from 'react'

export const DEAL_TIMING = { first: 400, gap: 350, choose: 300 } as const

/** Number of dealt cards flipped face up; flips one at a time unless motion is reduced. */
export function useDeal(count: number, reducedMotion: boolean) {
  const [revealed, setRevealed] = useState(reducedMotion ? count : 0)
  const revealAll = useCallback(() => setRevealed(count), [count])

  useEffect(() => {
    if (revealed >= count) return
    const id = setTimeout(() => setRevealed((r) => r + 1), revealed === 0 ? DEAL_TIMING.first : DEAL_TIMING.gap)
    return () => clearTimeout(id)
  }, [revealed, count])

  useEffect(() => {
    if (revealed >= count) return
    window.addEventListener('keydown', revealAll)
    return () => window.removeEventListener('keydown', revealAll)
  }, [revealed, count, revealAll])

  return { revealed, revealAll }
}
