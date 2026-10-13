import { expect, test } from 'vitest'
import { rollEdition } from './roll'

const w = (weights: Record<string, number>, forced = 'random') => ({ weights, forced })

test('weighted pick across cumulative boundaries', () => {
  const s = w({ common: 1, foil: 1, holo: 0, poly: 0 })
  expect(rollEdition(s, () => 0)).toBe('common')
  expect(rollEdition(s, () => 0.49)).toBe('common')
  expect(rollEdition(s, () => 0.5)).toBe('foil')
  expect(rollEdition(s, () => 0.999)).toBe('foil')
})

test('forced edition wins regardless of weights', () => {
  expect(rollEdition(w({ common: 100, foil: 0, holo: 0, poly: 0 }, 'holo'), () => 0)).toBe('holo')
})

test('unknown forced id falls back to random', () => {
  expect(rollEdition(w({ common: 0, foil: 1, holo: 0, poly: 0 }, 'nope'), () => 0.3)).toBe('foil')
})

test('all-zero weights give common', () => {
  expect(rollEdition(w({ common: 0, foil: 0, holo: 0, poly: 0 }), () => 0.7)).toBe('common')
})

test('negative, NaN and missing weights count as 0', () => {
  expect(rollEdition(w({ common: -5, foil: Number.NaN, holo: 2 }), () => 0.5)).toBe('holo')
})

test('rand() of exactly 1 still returns a weighted edition', () => {
  expect(rollEdition(w({ common: 0, foil: 3, holo: 0, poly: 0 }), () => 1)).toBe('foil')
})
