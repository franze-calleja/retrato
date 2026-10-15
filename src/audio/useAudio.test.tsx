import { act, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { useSound } from '../store/sound'
import { __setEngineForTest, getEngine } from './engine'
import { FakeAudioContext, asAudio } from './fakeAudio'
import * as music from './music'
import { useAudio } from './useAudio'

let fake: FakeAudioContext
beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useSound.getState().resetToDefault()
  useBooth.setState(useBooth.getInitialState(), true)
  fake = new FakeAudioContext()
  __setEngineForTest(asAudio(fake))
})
afterEach(() => {
  vi.restoreAllMocks()
  music.stopMusic()
  __setEngineForTest(undefined)
})

const setVisibility = (v: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
  fireEvent(document, new Event('visibilitychange'))
}

test('without Web Audio the hook does nothing', () => {
  __setEngineForTest(null)
  expect(() => renderHook(() => useAudio())).not.toThrow()
  fireEvent.pointerDown(document)
})

test('the first tap unlocks audio, sets the levels and starts the music', async () => {
  const start = vi.spyOn(music, 'startMusic')
  renderHook(() => useAudio())
  expect(start).not.toHaveBeenCalled()
  fireEvent.pointerDown(document)
  await waitFor(() => expect(start).toHaveBeenCalled())
  expect(fake.state).toBe('running')
  expect(getEngine()!.levels).toEqual({ music: 0.4, sfx: 0.7 })
})

test('effects-only mode keeps the music off', async () => {
  const start = vi.spyOn(music, 'startMusic')
  const stop = vi.spyOn(music, 'stopMusic')
  useSound.setState({ mode: 'sfx' })
  renderHook(() => useAudio())
  fireEvent.keyDown(document, { key: 'a' })
  await waitFor(() => expect(fake.state).toBe('running'))
  expect(start).not.toHaveBeenCalled()
  expect(stop).toHaveBeenCalled()
  expect(getEngine()!.levels).toEqual({ music: 0, sfx: 0.7 })
})

test('the shop gets the full mix, other screens the quiet one', () => {
  const mix = vi.spyOn(music, 'setMix')
  renderHook(() => useAudio())
  expect(mix).toHaveBeenLastCalledWith('full')
  act(() => useBooth.setState({ screen: 'booth' }))
  expect(mix).toHaveBeenLastCalledWith('quiet')
})

test('a hidden tab or the print dialog pauses audio, then it picks up again', async () => {
  renderHook(() => useAudio())
  fireEvent.pointerDown(document)
  await waitFor(() => expect(fake.state).toBe('running'))
  setVisibility('hidden')
  await waitFor(() => expect(fake.state).toBe('suspended'))
  setVisibility('visible')
  await waitFor(() => expect(fake.state).toBe('running'))
  fireEvent(window, new Event('beforeprint'))
  await waitFor(() => expect(fake.state).toBe('suspended'))
  fireEvent(window, new Event('afterprint'))
  await waitFor(() => expect(fake.state).toBe('running'))
})
