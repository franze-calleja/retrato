import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DEAL_TIMING, useDeal } from './useDeal'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('flips one card at a time', () => {
  const { result } = renderHook(() => useDeal(3, false))
  expect(result.current.revealed).toBe(0)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.first))
  expect(result.current.revealed).toBe(1)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.gap))
  expect(result.current.revealed).toBe(2)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.gap))
  expect(result.current.revealed).toBe(3)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.gap * 3))
  expect(result.current.revealed).toBe(3)
})

test('reduced motion starts fully revealed', () => {
  const { result } = renderHook(() => useDeal(3, true))
  expect(result.current.revealed).toBe(3)
})

test('revealAll and any key reveal everything', () => {
  const a = renderHook(() => useDeal(3, false))
  act(() => a.result.current.revealAll())
  expect(a.result.current.revealed).toBe(3)
  const b = renderHook(() => useDeal(3, false))
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  })
  expect(b.result.current.revealed).toBe(3)
})

test('unmounting mid-deal leaves no timers', () => {
  const { unmount } = renderHook(() => useDeal(3, false))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('cards become pickable only after the last flip has settled', () => {
  const { result } = renderHook(() => useDeal(3, false))
  act(() => result.current.revealAll())
  expect(result.current.pickable).toBe(false)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.settle - 1))
  expect(result.current.pickable).toBe(false)
  act(() => vi.advanceTimersByTime(1))
  expect(result.current.pickable).toBe(true)
})

test('reduced motion is pickable straight away', () => {
  const { result } = renderHook(() => useDeal(3, true))
  expect(result.current.pickable).toBe(true)
})
