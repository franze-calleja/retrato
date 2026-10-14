import { fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useIdleReset } from './useIdleReset'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('fires after the idle time with no activity', () => {
  const onIdle = vi.fn()
  renderHook(() => useIdleReset(3, onIdle, false))
  vi.advanceTimersByTime(3 * 60_000 - 1)
  expect(onIdle).not.toHaveBeenCalled()
  vi.advanceTimersByTime(1)
  expect(onIdle).toHaveBeenCalledTimes(1)
})

test('any touch, click or key restarts the wait', () => {
  const onIdle = vi.fn()
  renderHook(() => useIdleReset(1, onIdle, false))
  vi.advanceTimersByTime(50_000)
  fireEvent.pointerDown(window)
  vi.advanceTimersByTime(50_000)
  fireEvent.keyDown(window, { key: 'a' })
  vi.advanceTimersByTime(50_000)
  expect(onIdle).not.toHaveBeenCalled()
  vi.advanceTimersByTime(10_000)
  expect(onIdle).toHaveBeenCalledTimes(1)
})

test('0 minutes turns it off', () => {
  const onIdle = vi.fn()
  renderHook(() => useIdleReset(0, onIdle, false))
  vi.advanceTimersByTime(60 * 60_000)
  expect(onIdle).not.toHaveBeenCalled()
})

test('paused (operator panel open) never fires', () => {
  const onIdle = vi.fn()
  renderHook(() => useIdleReset(1, onIdle, true))
  vi.advanceTimersByTime(10 * 60_000)
  expect(onIdle).not.toHaveBeenCalled()
})
