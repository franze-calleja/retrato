import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import App from '../App'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'

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
  fireEvent.click(screen.getByRole('button', { name: /reset/i }))
  expect(useOperator.getState()).toMatchObject({ forced: 'random', weights: { holo: 12 } })
})

test('all-zero weights show 100% common', () => {
  for (const id of ['common', 'foil', 'holo', 'poly']) useOperator.getState().setWeight(id, 0)
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  expect(screen.getByTestId('pct-common').textContent).toBe('100%')
  expect(screen.getByTestId('pct-poly').textContent).toBe('0%')
})
