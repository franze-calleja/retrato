import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PRINT_TIMING, usePrintSequence } from './usePrintSequence'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
const step = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

test('walks flash → eject → develop → handoff → done', () => {
  const { result } = renderHook(() => usePrintSequence(false))
  expect(result.current.phase).toBe('flash')
  step(PRINT_TIMING.flash)
  expect(result.current.phase).toBe('eject')
  step(PRINT_TIMING.eject)
  expect(result.current.phase).toBe('develop')
  step(PRINT_TIMING.develop)
  expect(result.current.phase).toBe('handoff')
  step(PRINT_TIMING.handoff)
  expect(result.current.phase).toBe('done')
})

test.each(['flash', 'eject', 'develop', 'handoff'] as const)('skip from %s → done', (from) => {
  const { result } = renderHook(() => usePrintSequence(false))
  const order = ['flash', 'eject', 'develop', 'handoff'] as const
  for (const p of order.slice(0, order.indexOf(from))) step(PRINT_TIMING[p])
  expect(result.current.phase).toBe(from)
  act(() => result.current.skip())
  expect(result.current.phase).toBe('done')
})

test('a deliberate key skips; Tab and held keys do not', () => {
  const { result } = renderHook(() => usePrintSequence(false))
  fireEvent.keyDown(window, { key: 'Tab' })
  fireEvent.keyDown(window, { key: 'x', repeat: true })
  expect(result.current.phase).toBe('flash')
  fireEvent.keyDown(window, { key: 'x' })
  expect(result.current.phase).toBe('done')
})

test('reduced motion is done immediately', () => {
  const { result } = renderHook(() => usePrintSequence(true))
  expect(result.current.phase).toBe('done')
})

test('unmount clears timers', () => {
  const { unmount } = renderHook(() => usePrintSequence(false))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
