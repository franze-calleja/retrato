import { useCallback, useEffect, useState } from 'react'

export type OpenPhase = 'sealed' | 'shake' | 'tear' | 'burst' | 'done'

export const OPEN_TIMING = { auto: 3000, shake: 350, tear: 400, burst: 600 } as const

const NEXT: Record<Exclude<OpenPhase, 'done'>, OpenPhase> = { sealed: 'shake', shake: 'tear', tear: 'burst', burst: 'done' }

export const RARE_TINT = { holo: '#7fd6ff', poly: '#ff7fe1' } as const

/** Glow colour for the rarest edition in a pack (Polychrome beats Holographic), or null. */
export function rareTint(editionIds: string[]): string | null {
  if (editionIds.includes('poly')) return RARE_TINT.poly
  if (editionIds.includes('holo')) return RARE_TINT.holo
  return null
}

const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Alt', 'Control', 'Meta', 'CapsLock', 'Escape'])

/** A deliberate key press on the page: not Tab, a lone modifier, a shortcut, a held key, or typing in a field. */
export function isAdvanceKey(e: KeyboardEvent): boolean {
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || IGNORED_KEYS.has(e.key)) return false
  const t = e.target
  return !(t instanceof Element && t.closest('input, textarea, select, [role="dialog"]'))
}

/** Pack-opening phases: sealed (until tap or 3 s) → shake → tear → burst → done. Reduced motion starts done. */
export function usePackOpen(reducedMotion: boolean) {
  const [phase, setPhase] = useState<OpenPhase>(reducedMotion ? 'done' : 'sealed')
  const open = useCallback(() => setPhase((p) => (p === 'sealed' ? 'shake' : p)), [])
  const skip = useCallback(() => setPhase('done'), [])

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
