import { useCallback, useEffect, useRef, useState } from 'react'
import { setMix } from '../audio/music'
import { play, type Sfx, type Voice } from '../audio/sfx'
import { isAdvanceKey } from '../ui/keys'

export type OpenPhase = 'sealed' | 'shake' | 'tear' | 'burst' | 'done'

export const OPEN_TIMING = { auto: 3000, shake: 350, tear: 400, burst: 600 } as const

const NEXT: Record<Exclude<OpenPhase, 'done'>, OpenPhase> = { sealed: 'shake', shake: 'tear', tear: 'burst', burst: 'done' }
const PHASE_SFX: Partial<Record<OpenPhase, Sfx>> = { shake: 'shake', tear: 'tear', burst: 'burst' }

export const RARE_TINT = { holo: '#7fd6ff', poly: '#ff7fe1' } as const

/** Glow colour for the rarest edition in a pack (Polychrome beats Holographic), or null. */
export function rareTint(editionIds: string[]): string | null {
  if (editionIds.includes('poly')) return RARE_TINT.poly
  if (editionIds.includes('holo')) return RARE_TINT.holo
  return null
}

/** Pack-opening phases: sealed (until tap or 3 s) → shake → tear → burst → done. Reduced motion starts done. */
export function usePackOpen(reducedMotion: boolean) {
  const [phase, setPhase] = useState<OpenPhase>(reducedMotion ? 'done' : 'sealed')
  const open = useCallback(() => setPhase((p) => (p === 'sealed' ? 'shake' : p)), [])
  const voice = useRef<Voice | null>(null)
  const skip = useCallback(() => {
    voice.current?.stop()
    setPhase('done')
  }, [])

  // Each step has its sound; the tear dips the music so the rip cuts through.
  useEffect(() => {
    const sound = PHASE_SFX[phase]
    if (!sound) return
    voice.current = play(sound)
    if (phase === 'tear') setMix('duck')
  }, [phase])

  useEffect(() => {
    if (phase === 'done') return
    const id = setTimeout(() => setPhase(NEXT[phase]), phase === 'sealed' ? OPEN_TIMING.auto : OPEN_TIMING[phase])
    return () => clearTimeout(id)
  }, [phase])

  // Any key opens while sealed and skips after; Enter/Space on a button is left to its click.
  useEffect(() => {
    if (phase === 'done') return
    const onKey = (e: KeyboardEvent) => {
      if (!isAdvanceKey(e)) return
      if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return
      if (phase === 'sealed') open()
      else skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, open, skip])

  return { phase, open, skip }
}
