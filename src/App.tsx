import { useCallback, useEffect, useRef, useState } from 'react'
import { useAudio } from './audio/useAudio'
import { Booth } from './screens/Booth'
import { Editor } from './screens/Editor'
import { OperatorPanel } from './screens/OperatorPanel'
import { PackDeal } from './screens/PackDeal'
import { Shop } from './screens/Shop'
import { Tray, TrayButton } from './screens/Tray'
import { useBooth } from './store/booth'
import { useOperator } from './store/operator'
import { useSound } from './store/sound'
import { useTray } from './store/tray'
import { SwirlBackground } from './ui/SwirlBackground'
import { registerTap } from './ui/taps'
import { useIdleReset } from './ui/useIdleReset'

export default function App() {
  useAudio()
  const screen = useBooth((s) => s.screen)
  const trayOpen = useTray((s) => s.open)
  const wasTrayOpen = useRef(false)

  // Leaving the tray: put focus back on the tray button (or the logo when the tray was cleared).
  useEffect(() => {
    if (wasTrayOpen.current && !trayOpen)
      (document.querySelector<HTMLElement>('.tray-btn') ?? document.querySelector<HTMLElement>('.logo'))?.focus()
    wasTrayOpen.current = trayOpen
  }, [trayOpen])
  const [panelOpen, setPanelOpen] = useState(false)
  const taps = useRef<number[]>([])
  const closePanel = useCallback(() => setPanelOpen(false), [])
  const idleMinutes = useOperator((s) => s.idleMinutes)

  // Next guest: back to the shop with an empty tray and sound back on, so nobody inherits the previous guest's photos or mute.
  useIdleReset(
    idleMinutes,
    () => {
      useTray.getState().clear()
      useBooth.getState().goToPicker()
      useSound.getState().resetToDefault()
    },
    panelOpen,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyO') {
        e.preventDefault() // macOS would otherwise type Ø into a focused field
        setPanelOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onLogoTap() {
    const r = registerTap(taps.current, performance.now())
    taps.current = r.times
    if (r.triggered) setPanelOpen(true)
  }

  return (
    <>
      <SwirlBackground palette={screen === 'picker' ? 'shop' : 'booth'} />
      <main className="app">
        <h1 className="logo" tabIndex={-1} onClick={onLogoTap}>RETRATO</h1>
        <TrayButton />
        {trayOpen ? (
          <Tray />
        ) : (
          <>
            {screen === 'picker' && <Shop />}
            {screen === 'booth' && <Booth />}
            {screen === 'pack' && <PackDeal />}
            {screen === 'editor' && <Editor />}
          </>
        )}
        {panelOpen && <OperatorPanel onClose={closePanel} />}
      </main>
    </>
  )
}
