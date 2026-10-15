import { useEffect } from 'react'
import { play } from './sfx'

const TAPPABLE = 'button, select, summary, [role="button"], .tile-btn'
const HOVERABLE = '.tile-btn, .pack-btn'

/** A tap on something clickable that doesn't play its own sound (marked data-sfx). */
export function isTappable(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  const hit = target.closest(TAPPABLE)
  if (!hit || hit.closest('[data-sfx]')) return false
  return !(hit as HTMLButtonElement).disabled && hit.getAttribute('aria-disabled') !== 'true'
}

/** One page-wide listener so every button ticks without each one wiring a sound. */
export function useTapSounds() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (isTappable(e.target)) play('tick')
    }
    const onOver = (e: PointerEvent) => {
      if (!window.matchMedia?.('(pointer: fine)').matches) return
      const tile = e.target instanceof Element ? e.target.closest(HOVERABLE) : null
      if (tile && !(e.relatedTarget instanceof Node && tile.contains(e.relatedTarget))) play('hover')
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerover', onOver, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerover', onOver, true)
    }
  }, [])
}
