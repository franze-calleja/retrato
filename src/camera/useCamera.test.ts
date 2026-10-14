import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useCamera } from './useCamera'

function fakeStream() {
  const track = { stop: vi.fn() }
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }
}

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  const getUserMedia = vi.fn(impl)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  return getUserMedia
}

beforeEach(() => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('insecure context reports insecure without requesting the camera', async () => {
  Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
  const gum = mockGetUserMedia(() => Promise.reject(new Error('should not be called')))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('insecure')
  expect(gum).not.toHaveBeenCalled()
})

test('permission denied reports denied', async () => {
  mockGetUserMedia(() => Promise.reject(new DOMException('no', 'NotAllowedError')))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('denied')
})

test('no camera reports unavailable', async () => {
  mockGetUserMedia(() => Promise.reject(new DOMException('none', 'NotFoundError')))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('unavailable')
})

test('success goes live; stop() stops tracks and returns to idle', async () => {
  const { track, stream } = fakeStream()
  mockGetUserMedia(() => Promise.resolve(stream))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('live')
  act(() => result.current.stop())
  expect(track.stop).toHaveBeenCalled()
  expect(result.current.status).toBe('idle')
})

test('unmount stops a live stream', async () => {
  const { track, stream } = fakeStream()
  mockGetUserMedia(() => Promise.resolve(stream))
  const { result, unmount } = renderHook(() => useCamera())
  await act(() => result.current.start())
  unmount()
  expect(track.stop).toHaveBeenCalled()
})

test('stream that arrives after unmount is stopped immediately', async () => {
  const { track, stream } = fakeStream()
  let resolve!: (s: MediaStream) => void
  mockGetUserMedia(() => new Promise((r) => (resolve = r)))
  const { result, unmount } = renderHook(() => useCamera())
  let pending!: Promise<void>
  act(() => {
    pending = result.current.start()
  })
  unmount()
  resolve(stream)
  await pending
  expect(track.stop).toHaveBeenCalled()
})

test('a camera that disconnects reports disconnected instead of staying live', async () => {
  const listeners: Record<string, () => void> = {}
  const track = { stop: vi.fn(), addEventListener: (t: string, fn: () => void) => (listeners[t] = fn), removeEventListener: vi.fn() }
  mockGetUserMedia(() => Promise.resolve({ getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('live')
  act(() => listeners.ended())
  expect(result.current.status).toBe('disconnected')
})
