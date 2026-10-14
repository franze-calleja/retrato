import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useBooth } from '../store/booth'
import { useStats } from '../store/stats'
import { Booth } from './Booth'

test('upload control stays in the tab order (camera fallback must be keyboard reachable)', () => {
  render(<Booth />)
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  expect(input.type).toBe('file')
  expect(input.hidden).toBe(false)
  expect(input.tabIndex).toBeGreaterThanOrEqual(0)
})

test('pack mode shows the viewfinder for the chosen pack', () => {
  useBooth.setState({ ...useBooth.getInitialState(), mode: 'pack', packId: 'arcana', screen: 'booth' }, true)
  render(<Booth />)
  expect(screen.getByRole('heading', { name: 'Arcana Pack' })).toBeTruthy()
  expect(screen.getByRole('img', { name: /arcana pack live preview/i })).toBeTruthy()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('an upload that finishes after leaving the booth does not open the editor', async () => {
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth' }, true)
  let resolve!: (b: ImageBitmap) => void
  const close = vi.fn()
  vi.stubGlobal('createImageBitmap', () => new Promise<ImageBitmap>((r) => (resolve = r)))
  const { unmount } = render(<Booth />)
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
  unmount()
  useBooth.getState().goToPicker()
  await act(async () => resolve({ width: 10, height: 10, close } as unknown as ImageBitmap))
  expect(useBooth.getState().screen).toBe('picker')
  expect(useBooth.getState().capture).toBeNull()
  expect(close).toHaveBeenCalled()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('the countdown announces through one live region that stays mounted', () => {
  render(<Booth />)
  const live = document.querySelector('[aria-live="assertive"]')
  expect(live).not.toBeNull()
  expect(live!.closest('[data-testid="countdown-live"]')).not.toBeNull()
})

test('a camera that disconnects mid-countdown cancels the countdown', async () => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  const listeners: Record<string, () => void> = {}
  const track = { stop: vi.fn(), addEventListener: (t: string, fn: () => void) => (listeners[t] = fn) }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve({ getTracks: () => [track] }) },
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth' }, true)
  render(<Booth />)
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: /take photo/i }))
  expect(screen.getByTestId('countdown-live').textContent).toBe('3')
  act(() => listeners.ended())
  expect(screen.getByTestId('countdown-live').textContent).toBe('')
  expect(screen.getByRole('alert').textContent).toMatch(/camera stopped/i)
  vi.restoreAllMocks()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('the booth shows the camera front with a side screen named after the card', () => {
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'tarot' }, true)
  render(<Booth />)
  expect(document.querySelector('.camera-flip')!.getAttribute('data-side')).toBe('front')
  expect(screen.getByRole('img', { name: /tarot card live preview/i }).closest('.side-screen')).not.toBeNull()
  expect(screen.getByText('Tarot Card', { selector: '.side-screen *' })).toBeTruthy()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('Show back turns the camera; only the rear screen is the live preview then', () => {
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth' }, true)
  render(<Booth />)
  const toggle = screen.getByRole('button', { name: /show back/i })
  fireEvent.click(toggle)
  expect(useBooth.getState().cameraSide).toBe('back')
  expect(document.querySelector('.camera-flip')!.getAttribute('data-side')).toBe('back')
  expect(screen.getByRole('button', { name: /show front/i }).getAttribute('aria-pressed')).toBe('true')
  const previews = screen.getAllByRole('img', { name: /live preview/i })
  expect(previews).toHaveLength(1)
  expect(previews[0].closest('.rear-screen')).not.toBeNull()
  useBooth.setState(useBooth.getInitialState(), true)
})

/** A drawable stand-in for an ImageBitmap (the canvas mock only draws real image sources). */
function fakeBitmap() {
  const c = document.createElement('canvas')
  c.width = 800
  c.height = 600
  return Object.assign(c, { close: vi.fn() }) as unknown as ImageBitmap & { close: ReturnType<typeof vi.fn> }
}

async function uploadInto() {
  vi.stubGlobal('createImageBitmap', () => Promise.resolve(fakeBitmap()))
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
  })
}

test('an upload prints, develops, then opens the editor (single mode)', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', mode: 'single', templateId: 'stamp' }, true)
  render(<Booth />)
  await uploadInto()
  expect(document.querySelector('.instant-print')).not.toBeNull()
  expect(useBooth.getState().screen).toBe('booth')
  for (const ms of [150, 900, 1200, 450]) act(() => { vi.advanceTimersByTime(ms) })
  expect(useBooth.getState().screen).toBe('editor')
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('in pack mode the print goes into the pack', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', mode: 'pack', packId: 'classic' }, true)
  render(<Booth />)
  await uploadInto()
  for (const ms of [150, 900, 1200]) act(() => { vi.advanceTimersByTime(ms) })
  expect(document.querySelector('.instant-print')!.getAttribute('data-phase')).toBe('handoff')
  expect(document.querySelector('.print-pack')).not.toBeNull()
  act(() => { vi.advanceTimersByTime(450) })
  expect(useBooth.getState().screen).toBe('pack')
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('a key during develop skips straight to the card, capturing once', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  const before = useStats.getState().photos
  render(<Booth />)
  await uploadInto()
  act(() => { vi.advanceTimersByTime(150 + 900) })
  fireEvent.keyDown(window, { key: 'x' })
  act(() => { vi.advanceTimersByTime(5000) })
  expect(useBooth.getState().screen).toBe('editor')
  expect(useStats.getState().photos).toBe(before + 1)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('leaving mid-print captures nothing', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  const before = useStats.getState().photos
  const { unmount } = render(<Booth />)
  await uploadInto()
  unmount()
  act(() => { vi.advanceTimersByTime(5000) })
  expect(useBooth.getState().capture).toBeNull()
  expect(useStats.getState().photos).toBe(before)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('the frozen frame is copied once at capture time', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  const bmp = fakeBitmap()
  vi.stubGlobal('createImageBitmap', () => Promise.resolve(bmp))
  render(<Booth />)
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
  })
  // The bitmap is released right after freezing, before the print finishes.
  expect(bmp.close).toHaveBeenCalled()
  for (const ms of [150, 900, 1200, 450]) act(() => { vi.advanceTimersByTime(ms) })
  expect(useBooth.getState().capture!.source).not.toBe(bmp)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('reduced motion skips the print entirely', async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }),
  })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  render(<Booth />)
  await uploadInto()
  expect(useBooth.getState().screen).toBe('editor')
  Reflect.deleteProperty(window, 'matchMedia')
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})
