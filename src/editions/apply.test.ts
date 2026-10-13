import { describe, expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { badgeRect, maskToOpaque } from './apply'
import { editions } from './registry'

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe.each(templates.map((t) => [t.id, t] as const))('badge on %s', (_id, t) => {
  test.each(editions.filter((e) => e.badge).map((e) => [e.badge!] as const))('"%s" stays clear of the photo and inside the card', (badge) => {
    const r = badgeRect(badge, t.badgeAt)
    expect(overlaps(r, t.photoRect)).toBe(false)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(t.size.w)
    expect(r.y + r.h).toBeLessThanOrEqual(t.size.h)
  })
})

test('maskToOpaque clears overlay alpha wherever the art is not fully opaque (e.g. the drop shadow)', () => {
  const overlay = new ImageData(3, 1)
  const art = new ImageData(3, 1)
  overlay.data.set([9, 9, 9, 200, 9, 9, 9, 200, 9, 9, 9, 200])
  art.data.set([0, 0, 0, 255, 0, 0, 0, 115, 0, 0, 0, 0])
  maskToOpaque(overlay, art)
  expect([overlay.data[3], overlay.data[7], overlay.data[11]]).toEqual([200, 0, 0])
})
