import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { vi } from 'vitest'
import { OPEN_TIMING, rareTint, usePackOpen } from './usePackOpen'
import * as music from '../audio/music'
import * as sfx from '../audio/sfx'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const step = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

test('starts sealed and auto-opens after 3 s', () => {
  const { result } = renderHook(() => usePackOpen(false))
  expect(result.current.phase).toBe('sealed')
  step(OPEN_TIMING.auto - 1)
  expect(result.current.phase).toBe('sealed')
  step(1)
  expect(result.current.phase).toBe('shake')
})

test('open walks shake → tear → burst → done on the timings', () => {
  const { result } = renderHook(() => usePackOpen(false))
  act(() => result.current.open())
  expect(result.current.phase).toBe('shake')
  step(OPEN_TIMING.shake)
  expect(result.current.phase).toBe('tear')
  step(OPEN_TIMING.tear)
  expect(result.current.phase).toBe('burst')
  step(OPEN_TIMING.burst)
  expect(result.current.phase).toBe('done')
})

test('open is ignored once the pack is opening', () => {
  const { result } = renderHook(() => usePackOpen(false))
  act(() => result.current.open())
  step(OPEN_TIMING.shake)
  act(() => result.current.open())
  expect(result.current.phase).toBe('tear')
})

test.each(['sealed', 'shake', 'tear', 'burst'] as const)('skip from %s jumps to done', (from) => {
  const { result } = renderHook(() => usePackOpen(false))
  const order = ['sealed', 'shake', 'tear', 'burst'] as const
  if (from !== 'sealed') act(() => result.current.open())
  for (const p of order.slice(1, order.indexOf(from))) step(OPEN_TIMING[p as 'shake' | 'tear' | 'burst'])
  expect(result.current.phase).toBe(from)
  act(() => result.current.skip())
  expect(result.current.phase).toBe('done')
})

test('a key opens while sealed and skips after', () => {
  const { result } = renderHook(() => usePackOpen(false))
  fireEvent.keyDown(window, { key: 'x' })
  expect(result.current.phase).toBe('shake')
  fireEvent.keyDown(window, { key: 'x' })
  expect(result.current.phase).toBe('done')
})

test('Enter or Space on a focused button is left to its click handler', () => {
  const { result } = renderHook(() => usePackOpen(false))
  const button = document.createElement('button')
  document.body.appendChild(button)
  fireEvent.keyDown(button, { key: 'Enter' })
  fireEvent.keyDown(button, { key: ' ' })
  expect(result.current.phase).toBe('sealed')
  button.remove()
})

test('reduced motion starts done', () => {
  const { result } = renderHook(() => usePackOpen(true))
  expect(result.current.phase).toBe('done')
})

test('unmount clears pending timers', () => {
  const { unmount } = renderHook(() => usePackOpen(false))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('rare tint picks the rarest edition in the pack', () => {
  expect(rareTint(['common', 'foil'])).toBeNull()
  expect(rareTint(['holo', 'common'])).toBe('#7fd6ff')
  expect(rareTint(['holo', 'poly', 'foil'])).toBe('#ff7fe1')
})

test.each([
  ['Tab', { key: 'Tab' }],
  ['a modifier on its own', { key: 'Shift', shiftKey: true }],
  ['Alt held', { key: 'o', altKey: true }],
  ['a held-down key', { key: 'x', repeat: true }],
])('%s does not advance the opening', (_name, init) => {
  const { result } = renderHook(() => usePackOpen(false))
  fireEvent.keyDown(window, init)
  expect(result.current.phase).toBe('sealed')
})

test('typing in a field (operator panel) does not advance the opening', () => {
  const { result } = renderHook(() => usePackOpen(false))
  const input = document.createElement('input')
  document.body.appendChild(input)
  fireEvent.keyDown(input, { key: 'a' })
  expect(result.current.phase).toBe('sealed')
  input.remove()
})

test('opening sounds: shake, then tear (ducking the music), then burst', () => {
  const play = vi.spyOn(sfx, 'play').mockReturnValue(null)
  const mix = vi.spyOn(music, 'setMix')
  const { result } = renderHook(() => usePackOpen(false))
  expect(play).not.toHaveBeenCalled()
  act(() => result.current.open())
  expect(play).toHaveBeenLastCalledWith('shake')
  act(() => { vi.advanceTimersByTime(OPEN_TIMING.shake) })
  expect(play).toHaveBeenLastCalledWith('tear')
  expect(mix).toHaveBeenCalledWith('duck')
  act(() => { vi.advanceTimersByTime(OPEN_TIMING.tear) })
  expect(play).toHaveBeenLastCalledWith('burst')
  play.mockRestore()
  mix.mockRestore()
})

test('skipping stops the sound still ringing and plays no more', () => {
  const stop = vi.fn()
  const play = vi.spyOn(sfx, 'play').mockReturnValue({ stop })
  const { result } = renderHook(() => usePackOpen(false))
  act(() => result.current.open())
  act(() => result.current.skip())
  expect(stop).toHaveBeenCalledTimes(1)
  expect(play).toHaveBeenCalledTimes(1)
  play.mockRestore()
})
