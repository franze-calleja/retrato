import { useCallback, useEffect, useRef, useState } from 'react'
import { Booth } from './screens/Booth'
import { Editor } from './screens/Editor'
import { OperatorPanel } from './screens/OperatorPanel'
import { TemplatePicker } from './screens/TemplatePicker'
import { useBooth } from './store/booth'
import { SwirlBackground } from './ui/SwirlBackground'
import { registerTap } from './ui/taps'

export default function App() {
  const screen = useBooth((s) => s.screen)
  const [panelOpen, setPanelOpen] = useState(false)
  const taps = useRef<number[]>([])
  const closePanel = useCallback(() => setPanelOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyO') setPanelOpen(true)
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
      <SwirlBackground />
      <main className="app">
        <h1 className="logo" onClick={onLogoTap}>PIXEL BOOTH</h1>
        {screen === 'picker' && <TemplatePicker />}
        {screen === 'booth' && <Booth />}
        {screen === 'editor' && <Editor />}
        {panelOpen && <OperatorPanel onClose={closePanel} />}
      </main>
    </>
  )
}
