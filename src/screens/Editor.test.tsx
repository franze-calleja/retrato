import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fitCount } from '../print/layout'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { TRAY_MAX, useTray } from '../store/tray'
import { resolveDefaults } from '../templates/fields'
import * as registry from '../templates/registry'
import { getTemplate } from '../templates/registry'
import { Editor } from './Editor'

// Restore spies even when an assertion fails, so they never leak into later tests.
afterEach(() => vi.restoreAllMocks())

afterEach(() => useBooth.setState(useBooth.getInitialState(), true))

function open(revealed: boolean) {
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      screen: 'editor',
      templateId: 'ticket',
      edition: 'holo',
      values: resolveDefaults(getTemplate('ticket')),
      capture: { source: document.createElement('canvas'), w: 480, h: 512 },
      revealed,
    },
    true,
  )
  return render(<Editor />)
}

test('a card picked from a pack starts revealed', () => {
  const { container } = open(true)
  expect(container.querySelector('.reveal')?.getAttribute('data-phase')).toBe('shown')
})

test('a direct capture still plays the flip', () => {
  const { container } = open(false)
  expect(container.querySelector('.reveal')?.getAttribute('data-phase')).toBe('back')
})

beforeEach(() => {
  useTray.setState(useTray.getInitialState(), true)
  useOperator.getState().setPaper('a4')
  window.print = vi.fn()
})

const printImgs = () => [...document.querySelectorAll<HTMLImageElement>('.print-page img')]

test('Print lays out the chosen number of copies and prints once they load', () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  const imgs = printImgs()
  expect(imgs).toHaveLength(4)
  expect(imgs[0].style.width).toBe(`${getTemplate('ticket').printSizeMm.w}mm`)
  imgs.forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('Fill page prints as many copies as fit on one page', () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: 'fill' } })
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect(printImgs()).toHaveLength(fitCount(getTemplate('ticket').printSizeMm, 'a4'))
  expect(document.querySelectorAll('.print-page')).toHaveLength(1)
})

test('pressing Print twice prints once per press', () => {
  open(true)
  const print = screen.getByRole('button', { name: 'Print' })
  fireEvent.click(print)
  printImgs().forEach((img) => fireEvent.load(img))
  fireEvent.click(print)
  printImgs().forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(2)
})

test('Print does not touch the tray', () => {
  open(true)
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect(useTray.getState().items).toHaveLength(0)
})

test('Add to tray stores the card with its copies and confirms', async () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: /add to tray/i }))
  await waitFor(() => expect(useTray.getState().items).toHaveLength(1))
  expect(useTray.getState().items[0]).toMatchObject({
    templateId: 'ticket', name: getTemplate('ticket').name, edition: 'holo', copies: 2, size: getTemplate('ticket').printSizeMm,
  })
  expect(document.querySelector('.editor-note')!.textContent).toMatch(/added to tray/i)
})

test('a full tray disables Add and says why', () => {
  for (let i = 0; i < TRAY_MAX; i++)
    useTray.getState().add({ templateId: 'stamp', name: 'Stamp', edition: 'common', url: `blob:${i}`, size: { w: 50, h: 62 }, copies: 1 })
  open(true)
  expect((screen.getByRole('button', { name: /tray full \(20\)/i }) as HTMLButtonElement).disabled).toBe(true)
})

test('a failed render adds nothing and says so', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { cb(null) })
  open(true)
  fireEvent.click(screen.getByRole('button', { name: /add to tray/i }))
  await waitFor(() => expect(document.querySelector('.editor-note')!.textContent).toMatch(/couldn.t add this card/i))
  expect(useTray.getState().items).toHaveLength(0)
  vi.restoreAllMocks()
})

test('a printed job keeps the paper it was laid out for', () => {
  open(true)
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  act(() => useOperator.getState().setPaper('letter'))
  expect(document.querySelector('.print-sheets style')?.textContent).toMatch(/size:\s*A4/)
  expect((document.querySelector('.print-page') as HTMLElement).style.height).toBe('277mm')
})

test('Ctrl/Cmd+P in the editor prints the current card like the Print button', () => {
  open(true)
  const ev = createEvent.keyDown(window, { key: 'p', ctrlKey: true })
  fireEvent(window, ev)
  expect(ev.defaultPrevented).toBe(true)
  const imgs = printImgs()
  expect(imgs).toHaveLength(1)
  imgs.forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('if the tray fills before the card finishes rendering, its image is freed', async () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL')
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { setTimeout(() => cb(new Blob(['x']))) })
  open(true)
  fireEvent.click(screen.getByRole('button', { name: /add to tray/i }))
  for (let i = 0; i < TRAY_MAX; i++)
    useTray.getState().add({ templateId: 'stamp', name: 'Stamp', edition: 'common', url: `blob:${i}`, size: { w: 50, h: 62 }, copies: 1 })
  await waitFor(() => expect(screen.getByText(/tray full \(20\)/i, { selector: '.editor-note' })).toBeTruthy())
  expect(revoke).toHaveBeenCalledTimes(1)
  expect(useTray.getState().items).toHaveLength(TRAY_MAX)
  vi.restoreAllMocks()
})

test('a card that finishes rendering after the editor closes is still added, with no message timer left behind', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const { unmount } = open(true)
  let finish!: () => void
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { finish = () => cb(new Blob(['x'])) })
  fireEvent.click(screen.getByRole('button', { name: /add to tray/i }))
  unmount()
  finish()
  expect(useTray.getState().items).toHaveLength(1)
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('the rare-edition banner appears inside an already-mounted live region', () => {
  vi.useFakeTimers()
  open(false)
  const live = document.querySelector('[data-testid="reveal-live"]')!
  expect(live.getAttribute('role')).toBe('status')
  expect(live.textContent).toBe('')
  act(() => { vi.advanceTimersByTime(300) }) // back → flip
  act(() => { vi.advanceTimersByTime(700) }) // flip → shown + celebrate
  expect(document.querySelector('[data-testid="reveal-live"]')).toBe(live)
  expect(live.textContent).toMatch(/holographic!/i)
  vi.useRealTimers()
})

test('the editor card gets a glare unless motion is reduced', () => {
  open(true)
  expect(document.querySelector('.card-glare')).not.toBeNull()
})

test('reduced motion: no glare element', () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }),
  })
  open(true)
  expect(document.querySelector('.card-glare')).toBeNull()
  Reflect.deleteProperty(window, 'matchMedia')
})

test('reduced motion still gets a static card shadow', () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }),
  })
  open(true)
  expect(document.querySelector('.card-shadow')).not.toBeNull()
  Reflect.deleteProperty(window, 'matchMedia')
})

test('a field with options is a select that sets the value', () => {
  const t = { ...getTemplate('stamp') }
  const fields = [...t.fields, { key: 'mood', label: 'Mood', default: 'a', maxLength: 4, options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] }]
  const spy = vi.spyOn(registry, 'getTemplate').mockReturnValue({ ...t, fields } as never)
  open(true)
  const select = screen.getByLabelText('Mood') as HTMLSelectElement
  expect(select.tagName).toBe('SELECT')
  fireEvent.change(select, { target: { value: 'b' } })
  expect(useBooth.getState().values.mood).toBe('b')
  spy.mockRestore()
})

test('the glare cuts its photo hole for the current layout (full-art Joker)', async () => {
  const glare = await import('./glare')
  const spy = vi.spyOn(glare, 'glareClip')
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      screen: 'editor',
      templateId: 'jester',
      edition: 'common',
      values: { name: 'JOKER', effect: 'X', layout: 'fullart' },
      capture: { source: document.createElement('canvas'), w: 600, h: 800 },
      revealed: true,
    },
    true,
  )
  render(<Editor />)
  expect(spy).toHaveBeenCalled()
  expect(spy.mock.calls.at(-1)![0].photoRect).toEqual({ x: 4, y: 4, w: 88, h: 124 })
  spy.mockRestore()
})

test('the card and the controls sit in their own columns', () => {
  const { container } = open(true)
  const card = container.querySelector('.editor-card')
  const side = container.querySelector('.editor-side')
  expect(card?.querySelector('.reveal')).toBeInstanceOf(HTMLElement)
  expect(side?.querySelector('.reveal')).toBeNull()
  expect(side?.querySelector('h2')?.textContent).toBe(getTemplate('ticket').name)
  for (const name of ['Download PNG', 'Print', 'Add to tray', 'Retake', 'Change card']) {
    expect(side?.contains(screen.getByRole('button', { name }))).toBe(true)
  }
  expect(side?.contains(screen.getByLabelText(/copies/i))).toBe(true)
})

test('very short fields are marked so desktop can set them side by side', () => {
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      screen: 'editor',
      templateId: 'trading',
      edition: 'common',
      values: resolveDefaults(getTemplate('trading')),
      capture: { source: document.createElement('canvas'), w: 480, h: 512 },
      revealed: true,
    },
    true,
  )
  render(<Editor />)
  const label = (re: RegExp) => screen.getByLabelText(re).closest('label')
  expect(label(/^charm/i)?.classList.contains('field-short')).toBe(true)
  expect(label(/^luck/i)?.classList.contains('field-short')).toBe(true)
  expect(label(/^name/i)?.classList.contains('field-short')).toBe(false)
})
