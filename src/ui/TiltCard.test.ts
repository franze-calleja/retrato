import { expect, test } from 'vitest'
import { tiltFor } from './TiltCard'

const rect = { left: 100, top: 50, width: 200, height: 100 }

test('center is flat', () => {
  expect(tiltFor(200, 100, rect, 10)).toEqual({ rx: 0, ry: 0 })
})

test('right edge tilts +max around Y, top edge tilts +max around X', () => {
  expect(tiltFor(300, 100, rect, 10).ry).toBe(10)
  expect(tiltFor(200, 50, rect, 10).rx).toBe(10)
})

test('clamps when the pointer is outside the card', () => {
  expect(tiltFor(1000, 1000, rect, 10)).toEqual({ rx: -10, ry: 10 })
})
