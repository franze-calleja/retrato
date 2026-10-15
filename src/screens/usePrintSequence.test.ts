import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PRINT_TIMING, usePrintSequence } from './usePrintSequence'
import * as sfx from '../audio/sfx'

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

test('the print flashes, whirrs out and chimes at handoff; skipping stops the whirr', () => {
  const stop = vi.fn()
  const play = vi.spyOn(sfx, 'play').mockReturnValue({ stop })
  const { result } = renderHook(() => usePrintSequence(false))
  expect(play).toHaveBeenLastCalledWith('flash')
  act(() => { vi.advanceTimersByTime(PRINT_TIMING.flash) })
  expect(play).toHaveBeenLastCalledWith('whirr')
  act(() => result.current.skip())
  expect(stop).toHaveBeenCalled()
  expect(play.mock.calls.map((c) => c[0])).toEqual(['flash', 'whirr'])
  play.mockRestore()
})

test('a print left to run plays its chime at handoff', () => {
  const play = vi.spyOn(sfx, 'play').mockReturnValue(null)
  renderHook(() => usePrintSequence(false))
  for (const ms of [PRINT_TIMING.flash, PRINT_TIMING.eject, PRINT_TIMING.develop]) act(() => { vi.advanceTimersByTime(ms) })
  expect(play).toHaveBeenLastCalledWith('chime')
  play.mockRestore()
})
