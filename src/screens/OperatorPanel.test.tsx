import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../App'
import * as sfx from '../audio/sfx'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { useStats } from '../store/stats'
import { OperatorPanel } from './OperatorPanel'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useBooth.setState(useBooth.getInitialState(), true)
})

const logo = () => screen.getByRole('heading', { level: 1 })

test('five logo taps open the panel; Escape closes it', () => {
  render(<App />)
  for (let i = 0; i < 4; i++) fireEvent.click(logo())
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(logo())
  const dialog = screen.getByRole('dialog', { name: /operator settings/i })
  expect(document.activeElement).toBe(dialog)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('Shift+Alt+O opens the panel', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', key: 'Ø', shiftKey: true, altKey: true })
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('sliders, force select and reset update operator settings', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  fireEvent.change(screen.getByLabelText(/holographic/i), { target: { value: '40' } })
  expect(useOperator.getState().weights.holo).toBe(40)
  fireEvent.change(screen.getByLabelText(/force edition/i), { target: { value: 'poly' } })
  expect(useOperator.getState().forced).toBe('poly')
  fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }))
  expect(useOperator.getState()).toMatchObject({ forced: 'random', weights: { holo: 12 } })
})

test('all-zero weights show 100% common', () => {
  for (const id of ['common', 'foil', 'holo', 'poly']) useOperator.getState().setWeight(id, 0)
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  expect(screen.getByTestId('pct-common').textContent).toBe('100%')
  expect(screen.getByTestId('pct-poly').textContent).toBe('0%')
})

test('the operator can reset the photo counter', () => {
  useStats.getState().recordPhoto()
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  fireEvent.click(screen.getByRole('button', { name: /reset photo counter/i }))
  expect(useStats.getState().photos).toBe(0)
})

test('paper select sets the paper size', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  fireEvent.change(screen.getByLabelText(/paper/i), { target: { value: 'letter' } })
  expect(useOperator.getState().paper).toBe('letter')
})

test('Shift+Alt+O does not type Ø into the focused field', () => {
  render(<App />)
  const input = document.createElement('input')
  document.body.appendChild(input)
  const ev = createEvent.keyDown(input, { code: 'KeyO', key: 'Ø', shiftKey: true, altKey: true })
  fireEvent(input, ev)
  expect(ev.defaultPrevented).toBe(true)
  input.remove()
})

test('a drag that ends over the backdrop does not close the panel', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  const backdrop = document.querySelector('.operator-backdrop')!
  fireEvent.pointerDown(screen.getByLabelText(/holographic/i))
  fireEvent.click(backdrop)
  expect(screen.queryByRole('dialog')).not.toBeNull()
  fireEvent.pointerDown(backdrop)
  fireEvent.click(backdrop)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('Tab stays inside the panel', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  const dialog = screen.getByRole('dialog')
  const focusables = dialog.querySelectorAll<HTMLElement>('input, select, button')
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  last.focus()
  fireEvent.keyDown(last, { key: 'Tab' })
  expect(document.activeElement).toBe(first)
  first.focus()
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(last)
})

test('a press that starts on the backdrop but ends inside the panel does not close it', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  const backdrop = document.querySelector('.operator-backdrop')!
  fireEvent.pointerDown(backdrop)
  fireEvent.pointerUp(screen.getByRole('dialog'))
  fireEvent.click(backdrop)
  expect(screen.queryByRole('dialog')).not.toBeNull()
})

test('Tab from outside the panel goes into it', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  const first = screen.getByRole('dialog').querySelector<HTMLElement>('input, select, button')!
  ;(document.activeElement as HTMLElement).blur()
  fireEvent.keyDown(document.body, { key: 'Tab' })
  expect(document.activeElement).toBe(first)
})

test('sound: music and effects volumes, speaker button visibility, and a test sound', () => {
  const play = vi.spyOn(sfx, 'play').mockReturnValue(null)
  render(<OperatorPanel onClose={() => {}} />)
  fireEvent.change(screen.getByLabelText(/music volume/i), { target: { value: '25' } })
  fireEvent.change(screen.getByLabelText(/effects volume/i), { target: { value: '90' } })
  fireEvent.click(screen.getByLabelText(/show speaker button to guests/i))
  const s = useOperator.getState()
  expect([s.musicVolume, s.sfxVolume, s.showSoundButton]).toEqual([25, 90, false])
  expect(screen.getByTestId('pct-music').textContent).toBe('25%')
  fireEvent.click(screen.getByRole('button', { name: /test sound/i }))
  expect(play).toHaveBeenCalledWith('chime')
  play.mockRestore()
})
