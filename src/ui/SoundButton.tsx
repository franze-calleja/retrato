import { useEffect } from 'react'
import { getEngine } from '../audio/engine'
import { useOperator } from '../store/operator'
import { useSound, type SoundMode } from '../store/sound'

const LABEL: Record<SoundMode, string> = { all: 'Sound: all on', sfx: 'Sound: effects only', off: 'Sound: off' }

// Pixel speaker on an 11×9 grid: body plus waves (all), a note (effects only), or an X (off).
const BODY = 'M0 3h2v3H0zM2 2h1v5H2zM3 1h1v7H3zM4 0h1v9H4z'
const MARK: Record<SoundMode, string> = {
  all: 'M6 3h1v3H6zM8 1h1v1H8zM9 2h1v5H9zM8 7h1v1H8z',
  sfx: 'M7 1h3v1H7zM9 2h1v4H9zM7 5h2v2H7z',
  off: 'M6 2h1v1H6zM7 3h1v1H7zM8 4h1v1H8zM9 5h1v1H9zM10 6h1v1h-1zM10 2h1v1h-1zM9 3h1v1H9zM7 5h1v1H7zM6 6h1v1H6z',
}

function typing(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)
}

/** Guest sound toggle; M cycles it too unless keysOff (operator panel open) or the guest is typing. */
export function SoundButton({ keysOff }: { keysOff: boolean }) {
  const mode = useSound((s) => s.mode)
  const show = useOperator((s) => s.showSoundButton)
  const available = show && getEngine() !== null

  useEffect(() => {
    if (!available || keysOff) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      useSound.getState().cycle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [available, keysOff])

  if (!available) return null
  return (
    <button className="btn sound-btn" aria-label={LABEL[mode]} title={`${LABEL[mode]} (M)`} onClick={useSound.getState().cycle}>
      <svg viewBox="0 0 11 9" width="22" height="18" aria-hidden="true" shapeRendering="crispEdges" fill="currentColor">
        <path d={BODY} />
        <path d={MARK[mode]} />
      </svg>
    </button>
  )
}
