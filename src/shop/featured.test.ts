import { expect, test } from 'vitest'
import { FEATURED_COUNT, nextFeatured } from './featured'

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

test('picks FEATURED_COUNT distinct ids', () => {
  const next = nextFeatured(ids, [], Math.random)
  expect(next).toHaveLength(FEATURED_COUNT)
  expect(new Set(next).size).toBe(FEATURED_COUNT)
})

test('a reroll never returns the same set when there is another to show', () => {
  for (let i = 0; i < 50; i++) {
    const current = nextFeatured(ids, [], Math.random)
    const next = nextFeatured(ids, current, Math.random)
    expect([...next].sort()).not.toEqual([...current].sort())
  }
})

test('with only as many ids as slots, the set stays the same', () => {
  expect(nextFeatured(['a', 'b', 'c'], ['a', 'b', 'c'], Math.random).sort()).toEqual(['a', 'b', 'c'])
})
