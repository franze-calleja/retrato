import { expect, test } from 'vitest'
import { SNAPSHOT_ANGLE, angleFor, driftAngle, quantizeAngle } from './angle'

test('quantizeAngle snaps to 64 steps and wraps into [0, 1)', () => {
  expect(quantizeAngle(0.1)).toBe(quantizeAngle(0.1004))
  expect(quantizeAngle(0.1)).not.toBe(quantizeAngle(0.6))
  expect(quantizeAngle(1)).toBe(0)
  expect(quantizeAngle(-0.25)).toBe(0.75)
  expect(quantizeAngle(0.999)).toBe(0)
})

test('angleFor maps the card diagonal to 0..1 and clamps', () => {
  const rect = { left: 0, top: 0, width: 100, height: 200 }
  expect(angleFor(0, 0, rect)).toBe(0)
  expect(angleFor(100, 200, rect)).toBe(1)
  expect(angleFor(50, 100, rect)).toBe(0.5)
  expect(angleFor(-50, 900, rect)).toBe(0.5)
})

test('driftAngle starts at the snapshot angle and loops every 20 s', () => {
  expect(driftAngle(0)).toBeCloseTo(SNAPSHOT_ANGLE)
  expect(driftAngle(20_000)).toBeCloseTo(SNAPSHOT_ANGLE)
  expect(driftAngle(10_000)).toBeCloseTo(0.85)
})
