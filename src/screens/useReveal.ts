import { useCallback, useEffect, useRef, useState } from 'react'
import { play, type Sfx } from '../audio/sfx'

export type RevealPhase = 'back' | 'flip' | 'shown'

export const REVEAL_TIMING = { back: 250, flip: 600, celebrate: 1200 } as const

/** `sound` plays as the card lands face up (the edition's arpeggio). */
export function useReveal(rare: boolean, reducedMotion: boolean, sound?: Sfx) {
  const [phase, setPhase] = useState<RevealPhase>(reducedMotion ? 'shown' : 'back')
  const [celebrate, setCelebrate] = useState(false)
  const phaseRef = useRef(phase)

  const show = useCallback(() => {
    if (phaseRef.current === 'shown') return
    phaseRef.current = 'shown'
    setPhase('shown')
    if (sound) play(sound)
    if (rare && !reducedMotion) setCelebrate(true)
  }, [rare, reducedMotion, sound])

  // Advance back → flip → shown.
  useEffect(() => {
    if (phase === 'shown') return
    const id = setTimeout(() => {
      if (phase === 'flip') return show()
      phaseRef.current = 'flip'
      setPhase('flip')
      play('flip')
    }, REVEAL_TIMING[phase])
    return () => clearTimeout(id)
  }, [phase, show])

  // Any key skips while the card is still turning.
  useEffect(() => {
    if (phase === 'shown') return
    window.addEventListener('keydown', show)
    return () => window.removeEventListener('keydown', show)
  }, [phase, show])

  // End the rare-edition celebration.
  useEffect(() => {
    if (!celebrate) return
    const id = setTimeout(() => setCelebrate(false), REVEAL_TIMING.celebrate)
    return () => clearTimeout(id)
  }, [celebrate])

  return { phase, celebrate, skip: show }
}
