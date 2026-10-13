import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OPERATOR_KEY, defaultSettings, loadSettings, sanitize, useOperator } from './operator'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

test('defaults', () => {
  expect(defaultSettings()).toEqual({ weights: { common: 60, foil: 25, holo: 12, poly: 3 }, forced: 'random' })
})

test('setWeight and setForced persist; loadSettings restores them', () => {
  useOperator.getState().setWeight('holo', 50)
  useOperator.getState().setForced('poly')
  expect(JSON.parse(localStorage.getItem(OPERATOR_KEY)!)).toEqual({
    weights: { common: 60, foil: 25, holo: 50, poly: 3 },
    forced: 'poly',
  })
  expect(loadSettings()).toEqual({ weights: { common: 60, foil: 25, holo: 50, poly: 3 }, forced: 'poly' })
})

test('setWeight clamps to 0–100 and ignores unknown editions', () => {
  useOperator.getState().setWeight('foil', 500)
  useOperator.getState().setWeight('common', -3)
  useOperator.getState().setWeight('nope', 10)
  expect(useOperator.getState().weights).toEqual({ common: 0, foil: 100, holo: 12, poly: 3 })
})

test('setForced ignores unknown ids', () => {
  useOperator.getState().setForced('nope')
  expect(useOperator.getState().forced).toBe('random')
})

test('reset restores defaults and persists them', () => {
  useOperator.getState().setWeight('poly', 90)
  useOperator.getState().reset()
  expect(useOperator.getState().weights.poly).toBe(3)
  expect(loadSettings().weights.poly).toBe(3)
})

test('sanitize: corrupt shapes and values fall back per field', () => {
  expect(sanitize(null)).toEqual(defaultSettings())
  expect(sanitize('x')).toEqual(defaultSettings())
  expect(sanitize({ weights: { common: 'a', foil: -4, holo: 101, extra: 9 }, forced: 'nope' })).toEqual({
    weights: { common: 60, foil: 0, holo: 100, poly: 3 },
    forced: 'random',
  })
})

test('corrupt stored JSON loads defaults', () => {
  localStorage.setItem(OPERATOR_KEY, '{nope')
  expect(loadSettings()).toEqual(defaultSettings())
})

test('storage that throws never breaks reads or writes', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(loadSettings()).toEqual(defaultSettings())
  expect(() => useOperator.getState().setWeight('foil', 40)).not.toThrow()
  expect(useOperator.getState().weights.foil).toBe(40)
})
