import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { REVEAL_TIMING, useReveal } from './useReveal'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('back → flip → shown on schedule; common editions do not celebrate', () => {
  const { result } = renderHook(() => useReveal(false, false))
  expect(result.current.phase).toBe('back')
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.back))
  expect(result.current.phase).toBe('flip')
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.flip))
  expect(result.current.phase).toBe('shown')
  expect(result.current.celebrate).toBe(false)
})

test('rare editions celebrate for a while after the flip', () => {
  const { result } = renderHook(() => useReveal(true, false))
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.back))
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.flip))
  expect(result.current.celebrate).toBe(true)
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.celebrate))
  expect(result.current.celebrate).toBe(false)
})

test('reduced motion starts shown with no celebration', () => {
  const { result } = renderHook(() => useReveal(true, true))
  expect(result.current.phase).toBe('shown')
  expect(result.current.celebrate).toBe(false)
})

test('skip jumps to shown, is idempotent, and still celebrates rare editions', () => {
  const { result } = renderHook(() => useReveal(true, false))
  act(() => result.current.skip())
  act(() => result.current.skip())
  expect(result.current.phase).toBe('shown')
  expect(result.current.celebrate).toBe(true)
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.back + REVEAL_TIMING.flip))
  expect(result.current.phase).toBe('shown')
})

test('a keypress during the reveal skips it', () => {
  const { result } = renderHook(() => useReveal(false, false))
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
  })
  expect(result.current.phase).toBe('shown')
})

test('unmounting mid-reveal leaves no pending timers', () => {
  const { unmount } = renderHook(() => useReveal(true, false))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
