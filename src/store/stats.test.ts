import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { STATS_KEY, loadPhotos, useStats } from './stats'

beforeEach(() => {
  localStorage.clear()
  useStats.getState().resetPhotos()
})
afterEach(() => vi.restoreAllMocks())

test('records photos and keeps the count across reloads', () => {
  useStats.getState().recordPhoto()
  useStats.getState().recordPhoto()
  expect(useStats.getState().photos).toBe(2)
  expect(JSON.parse(localStorage.getItem(STATS_KEY)!)).toEqual({ photos: 2 })
  expect(loadPhotos()).toBe(2)
})

test('reset goes back to 0 and is saved', () => {
  useStats.getState().recordPhoto()
  useStats.getState().resetPhotos()
  expect(useStats.getState().photos).toBe(0)
  expect(loadPhotos()).toBe(0)
})

test('corrupt or negative stored counts load as 0', () => {
  localStorage.setItem(STATS_KEY, '{nope')
  expect(loadPhotos()).toBe(0)
  localStorage.setItem(STATS_KEY, JSON.stringify({ photos: -4 }))
  expect(loadPhotos()).toBe(0)
  localStorage.setItem(STATS_KEY, JSON.stringify({ photos: 2.5 }))
  expect(loadPhotos()).toBe(0)
})

test('blocked storage still counts in memory', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(loadPhotos()).toBe(0)
  expect(() => useStats.getState().recordPhoto()).not.toThrow()
  expect(useStats.getState().photos).toBe(1)
})
