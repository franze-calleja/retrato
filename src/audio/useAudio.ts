import { useEffect, useState } from 'react'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { effectiveLevels, useSound } from '../store/sound'
import { useTray } from '../store/tray'
import { getEngine, isRunning, resume, setLevels, suspend, unlock } from './engine'
import { setMix, startMusic, stopMusic } from './music'

const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const

/** App-wide audio: unlock on a gesture, follow the volumes, play music, mix per screen, pause when hidden. */
export function useAudio() {
  const mode = useSound((s) => s.mode)
  const musicVolume = useOperator((s) => s.musicVolume)
  const sfxVolume = useOperator((s) => s.sfxVolume)
  const screen = useBooth((s) => s.screen)
  const trayOpen = useTray((s) => s.open)
  const [running, setRunning] = useState(false)
  const { music, sfx } = effectiveLevels(mode, musicVolume, sfxVolume)
  const musicOn = music > 0

  // Browsers only start audio from a gesture, so try on every tap or key until it runs.
  useEffect(() => {
    if (!getEngine()) return
    const onGesture = () => {
      if (isRunning() || document.visibilityState === 'hidden') return
      void unlock().then(setRunning)
    }
    // Touch only counts as a gesture on release (pointerup/touchend/click), a mouse already on press.
    for (const type of GESTURES) document.addEventListener(type, onGesture, true)
    return () => {
      for (const type of GESTURES) document.removeEventListener(type, onGesture, true)
    }
  }, [])

  useEffect(() => setLevels({ music, sfx }), [music, sfx])

  useEffect(() => {
    if (running && musicOn) startMusic()
    else stopMusic()
  }, [running, musicOn])

  useEffect(() => setMix(trayOpen || screen !== 'picker' ? 'quiet' : 'full'), [screen, trayOpen])

  // A hidden tab or the print dialog pauses everything; it picks up where it was afterwards.
  useEffect(() => {
    if (!getEngine()) return
    let paused = false
    const pause = () => {
      if (!isRunning()) return
      paused = true
      void suspend()
    }
    const pickUp = () => {
      if (!paused) return
      paused = false
      void resume()
    }
    const onVisibility = () => (document.visibilityState === 'hidden' ? pause() : pickUp())
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeprint', pause)
    window.addEventListener('afterprint', pickUp)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeprint', pause)
      window.removeEventListener('afterprint', pickUp)
    }
  }, [])

  useEffect(() => () => stopMusic(), [])
}
