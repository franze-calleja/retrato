import { TemplatePicker } from './screens/TemplatePicker'
import { useBooth } from './store/booth'
import { SwirlBackground } from './ui/SwirlBackground'

export default function App() {
  const screen = useBooth((s) => s.screen)
  return (
    <>
      <SwirlBackground />
      <main className="app">
        <h1 className="logo">PIXEL BOOTH</h1>
        {screen === 'picker' && <TemplatePicker />}
        {screen === 'booth' && <p>Booth coming soon</p>}
        {screen === 'editor' && <p>Editor coming soon</p>}
      </main>
    </>
  )
}
