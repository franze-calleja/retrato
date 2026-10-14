import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { PackCard } from '../packs/deal'
import { useBooth } from '../store/booth'
import { DEAL_TIMING } from './useDeal'
import { PackDeal } from './PackDeal'
import { OPEN_TIMING } from './usePackOpen'

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

/** Open the pack and skip the ceremony, landing on the face-down deal. */
function skipOpening() {
  fireEvent.keyDown(window, { key: 'x' }) // open
  fireEvent.keyDown(window, { key: 'x' }) // skip
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  useBooth.setState(useBooth.getInitialState(), true)
  Reflect.deleteProperty(window, 'matchMedia')
})

test('reduced motion: all three cards are face up and named by type and edition', () => {
  setup(true)
  expect(screen.getByRole('button', { name: 'Stamp: A, Common edition' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ticket: B, Holographic edition' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Trading Card: C, Foil edition' })).toBeTruthy()
})

test('tapping while dealing reveals all instead of picking', () => {
  setup(false)
  skipOpening()
  const faceDown = screen.getAllByRole('button', { name: 'Face-down card' })
  fireEvent.click(faceDown[0])
  expect(useBooth.getState().screen).toBe('pack')
  expect(screen.getByRole('button', { name: 'Stamp: A, Common edition' })).toBeTruthy()
})

test('choosing a card opens the editor with it; a second tap is ignored', () => {
  setup(true)
  fireEvent.click(screen.getByRole('button', { name: 'Ticket: B, Holographic edition' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stamp: A, Common edition' }))
  act(() => vi.advanceTimersByTime(DEAL_TIMING.choose))
  const s = useBooth.getState()
  expect([s.screen, s.templateId, s.edition, s.revealed]).toEqual(['editor', 'ticket', 'holo', true])
})

test('a double-tap while dealing reveals but does not keep an unseen card', () => {
  setup(false)
  skipOpening()
  const [first] = screen.getAllByRole('button', { name: 'Face-down card' })
  fireEvent.click(first)
  fireEvent.click(screen.getByRole('button', { name: 'Stamp: A, Common edition' }))
  act(() => vi.advanceTimersByTime(DEAL_TIMING.choose))
  expect(useBooth.getState().screen).toBe('pack')
  act(() => vi.advanceTimersByTime(DEAL_TIMING.settle))
  fireEvent.click(screen.getByRole('button', { name: 'Stamp: A, Common edition' }))
  act(() => vi.advanceTimersByTime(DEAL_TIMING.choose))
  expect([useBooth.getState().screen, useBooth.getState().templateId]).toEqual(['editor', 'stamp'])
})

test('three cards of the same type get distinct labels', () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  })
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      mode: 'pack',
      screen: 'pack',
      capture: { source: document.createElement('canvas'), w: 1600, h: 900 },
      pack: ['THE STAR', 'THE SUN', 'THE MOON'].map((title) => ({ templateId: 'tarot', edition: 'common', values: { title } })),
    },
    true,
  )
  render(<PackDeal />)
  for (const t of ['THE STAR', 'THE SUN', 'THE MOON']) {
    expect(screen.getByRole('button', { name: `Tarot Card: ${t}, Common edition` })).toBeTruthy()
  }
})

test('focus moves to the deal heading so screen readers know the screen changed', () => {
  setup(true)
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: /pick one to keep/i }))
})

test('the sealed pack comes first, then the cards after the opening', () => {
  setup(false)
  expect(screen.getByRole('heading', { name: /open your pack/i })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Face-down card' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /open the classic pack/i }))
  act(() => vi.advanceTimersByTime(OPEN_TIMING.shake))
  act(() => vi.advanceTimersByTime(OPEN_TIMING.tear))
  act(() => vi.advanceTimersByTime(OPEN_TIMING.burst))
  expect(screen.getByRole('heading', { name: /pick one to keep/i })).toBeTruthy()
  expect(screen.getAllByRole('button', { name: 'Face-down card' })).toHaveLength(3)
  expect(document.querySelector('.deal')?.classList.contains('from-pack')).toBe(true)
})

test('Enter on the focused pack opens it once instead of skipping', () => {
  setup(false)
  const stage = screen.getByRole('button', { name: /open the classic pack/i })
  stage.focus()
  fireEvent.keyDown(stage, { key: 'Enter' })
  fireEvent.click(stage)
  expect(stage.getAttribute('data-phase')).toBe('shake')
})

test('skipping mid-tear lands on the deal, whose flips run from their own start', () => {
  setup(false)
  fireEvent.keyDown(window, { key: 'x' })
  act(() => vi.advanceTimersByTime(OPEN_TIMING.shake))
  fireEvent.keyDown(window, { key: 'x' })
  expect(screen.getAllByRole('button', { name: 'Face-down card' })).toHaveLength(3)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.first - 1))
  expect(screen.getAllByRole('button', { name: 'Face-down card' })).toHaveLength(3)
  act(() => vi.advanceTimersByTime(1))
  expect(screen.getAllByRole('button', { name: 'Face-down card' })).toHaveLength(2)
})

test('focus returns to the heading when the cards appear', () => {
  setup(false)
  screen.getByRole('button', { name: /open the classic pack/i }).focus()
  skipOpening()
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: /pick one to keep/i }))
})

test('a pack holding a rare card glows in its colour', () => {
  setup(false)
  expect((screen.getByRole('button', { name: /open the classic pack/i }) as HTMLElement).style.getPropertyValue('--glow')).toBe('#7fd6ff')
})
