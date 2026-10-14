import { useCallback, useEffect, useState } from 'react'

// settle: the last card's flip must finish before a pick counts, so a double-tap can't keep an unseen card.
export const DEAL_TIMING = { first: 400, gap: 350, settle: 500, choose: 300 } as const

/** Number of dealt cards flipped face up; flips one at a time unless motion is reduced. */
export function useDeal(count: number, reducedMotion: boolean) {
  const [revealed, setRevealed] = useState(reducedMotion ? count : 0)
  const [pickable, setPickable] = useState(reducedMotion)
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

  useEffect(() => {
    if (revealed < count || pickable) return
    const id = setTimeout(() => setPickable(true), DEAL_TIMING.settle)
    return () => clearTimeout(id)
  }, [revealed, count, pickable])

  return { revealed, pickable, revealAll }
}
