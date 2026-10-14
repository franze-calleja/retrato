import { expect, test } from 'vitest'
import { shapeSpans } from './shapes'

test('rect covers every row fully', () => {
  expect(shapeSpans(4, 3, 'rect')).toEqual([[0, 0, 4], [1, 0, 4], [2, 0, 4]])
})

test('circle stays inside its box, is widest in the middle, and is symmetric', () => {
  const spans = shapeSpans(20, 20, 'circle')
  for (const [, x0, x1] of spans) {
    expect(x0).toBeGreaterThanOrEqual(0)
    expect(x1).toBeLessThanOrEqual(20)
    expect(x0 + x1).toBe(20)
  }
  const width = (y: number) => spans.find((s) => s[0] === y)!
  expect(width(10)[2] - width(10)[1]).toBeGreaterThan(width(1)[2] - width(1)[1])
})

test('arch is rounded on top and full width below the curve', () => {
  const spans = shapeSpans(20, 40, 'arch')
  const row = (y: number) => spans.find((s) => s[0] === y)!
  expect(row(0)[2] - row(0)[1]).toBeLessThan(20)
  expect(row(30)).toEqual([30, 0, 20])
  expect(row(39)).toEqual([39, 0, 20])
})
