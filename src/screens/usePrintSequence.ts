import { useCallback, useEffect, useRef, useState } from 'react'
import { play, type Voice } from '../audio/sfx'
import { isAdvanceKey } from '../ui/keys'

export type PrintPhase = 'flash' | 'eject' | 'develop' | 'handoff' | 'done'

export const PRINT_TIMING = { flash: 150, eject: 900, develop: 1200, handoff: 450 } as const

const NEXT: Record<Exclude<PrintPhase, 'done'>, PrintPhase> = { flash: 'eject', eject: 'develop', develop: 'handoff', handoff: 'done' }

/** Instant print: flash → eject → develop → handoff → done. Reduced motion is done at once. */
export function usePrintSequence(reducedMotion: boolean) {
  const [phase, setPhase] = useState<PrintPhase>(reducedMotion ? 'done' : 'flash')
  const voices = useRef<Voice[]>([])
  const skip = useCallback(() => {
    for (const v of voices.current) v.stop()
    setPhase('done')
  }, [])

  // Flash zap, motor whirr as the print slides out, a chime as it's handed over.
  useEffect(() => {
    const sound = phase === 'flash' ? 'flash' : phase === 'eject' ? 'whirr' : phase === 'handoff' ? 'chime' : null
    const voice = sound && play(sound)
    if (voice) voices.current.push(voice)
  }, [phase])

  useEffect(() => {
    if (phase === 'done') return
    const id = setTimeout(() => setPhase(NEXT[phase]), PRINT_TIMING[phase])
    return () => clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'done') return
    const onKey = (e: KeyboardEvent) => {
      if (isAdvanceKey(e)) skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, skip])

  return { phase, skip }
}
