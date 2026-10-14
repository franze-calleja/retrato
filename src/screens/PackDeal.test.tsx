import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { PackCard } from '../packs/deal'
import { useBooth } from '../store/booth'
import { DEAL_TIMING } from './useDeal'
import { PackDeal } from './PackDeal'

const pack: PackCard[] = [
  { templateId: 'stamp', edition: 'common', values: { title: 'A', value: '1¢' } },
  { templateId: 'ticket', edition: 'holo', values: { event: 'B', date: '2026-01-01', serial: 'NO. 000001' } },
  { templateId: 'trading', edition: 'foil', values: { name: 'C', type: 'D', charm: '1', chaos: '2', luck: '3' } },
]

function setup(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: reduced && q.includes('reduce'), addEventListener() {}, removeEventListener() {} }),
  })
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      mode: 'pack',
      screen: 'pack',
      capture: { source: document.createElement('canvas'), w: 1600, h: 900 },
      pack,
    },
    true,
  )
  render(<PackDeal />)
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  useBooth.setState(useBooth.getInitialState(), true)
  Reflect.deleteProperty(window, 'matchMedia')
})

test('reduced motion: all three cards are face up and named by type and edition', () => {
  setup(true)
  expect(screen.getByRole('button', { name: 'Stamp, Common edition' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ticket, Holographic edition' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Trading Card, Foil edition' })).toBeTruthy()
})

test('tapping while dealing reveals all instead of picking', () => {
  setup(false)
  const faceDown = screen.getAllByRole('button', { name: 'Face-down card' })
  fireEvent.click(faceDown[0])
  expect(useBooth.getState().screen).toBe('pack')
  expect(screen.getByRole('button', { name: 'Stamp, Common edition' })).toBeTruthy()
})

test('choosing a card opens the editor with it; a second tap is ignored', () => {
  setup(true)
  fireEvent.click(screen.getByRole('button', { name: 'Ticket, Holographic edition' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stamp, Common edition' }))
  act(() => vi.advanceTimersByTime(DEAL_TIMING.choose))
  const s = useBooth.getState()
  expect([s.screen, s.templateId, s.edition, s.revealed]).toEqual(['editor', 'ticket', 'holo', true])
})

test('a double-tap while dealing reveals but does not keep an unseen card', () => {
  setup(false)
  const [first] = screen.getAllByRole('button', { name: 'Face-down card' })
  fireEvent.click(first)
  fireEvent.click(screen.getByRole('button', { name: 'Stamp, Common edition' }))
  act(() => vi.advanceTimersByTime(DEAL_TIMING.choose))
  expect(useBooth.getState().screen).toBe('pack')
  act(() => vi.advanceTimersByTime(DEAL_TIMING.settle))
  fireEvent.click(screen.getByRole('button', { name: 'Stamp, Common edition' }))
  act(() => vi.advanceTimersByTime(DEAL_TIMING.choose))
  expect([useBooth.getState().screen, useBooth.getState().templateId]).toEqual(['editor', 'stamp'])
})
