import { expect, test } from 'vitest'
import { displayedOdds, editionPercents } from './odds'

test('percentages from weights', () => {
  expect(editionPercents({ common: 60, foil: 25, holo: 12, poly: 3 })).toEqual({ common: 60, foil: 25, holo: 12, poly: 3 })
  expect(editionPercents({ common: 1, foil: 1, holo: 0, poly: 0 })).toEqual({ common: 50, foil: 50, holo: 0, poly: 0 })
})

test('all-zero or garbage weights mean 100% common', () => {
  expect(editionPercents({ common: 0, foil: 0, holo: 0, poly: 0 })).toEqual({ common: 100, foil: 0, holo: 0, poly: 0 })
  expect(editionPercents({ common: -1, foil: Number.NaN })).toEqual({ common: 100, foil: 0, holo: 0, poly: 0 })
})

test('displayed odds show a forced edition as 100%', () => {
  const weights = { common: 60, foil: 25, holo: 12, poly: 3 }
  expect(displayedOdds({ weights, forced: 'holo' })).toEqual({ common: 0, foil: 0, holo: 100, poly: 0 })
  expect(displayedOdds({ weights, forced: 'random' })).toEqual(editionPercents(weights))
})
