import { expect, test, vi } from 'vitest'
import { stamp } from './stamp'

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

test('bigger photo window, same print size', () => {
  expect(stamp.photoRect).toEqual({ x: 10, y: 10, w: 76, h: 82 })
  expect(stamp.size).toEqual({ w: 99, h: 123 })
  expect(stamp.printSizeMm).toEqual({ w: 50, h: 62.1 })
})

test('nothing but the mat keyline is drawn inside the photo window', () => {
  const c = document.createElement('canvas')
  c.width = stamp.size.w
  c.height = stamp.size.h
  const ctx = c.getContext('2d')!
  // The body is drawn on an offscreen canvas (for its drop shadow), so watch every canvas.
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  stamp.render(ctx, { title: 'WWWWWWWWWWWWWW', value: '99¢' })
  const inner = { ...stamp.photoRect }
  const bad = fr.mock.calls
    .map(([x, y, w, h]) => ({ x, y, w, h }))
    // Background fills that span the card (body, engraving lines) lie under the mat and photo; detail must stay off it.
    .filter((r) => r.w * r.h < 400 && r.w < 88 && overlaps(r, inner))
  expect(fr.mock.calls.length).toBeGreaterThan(100)
  expect(bad).toEqual([])
  fr.mockRestore()
})

test('long titles and values stay inside the card', () => {
  const c = document.createElement('canvas').getContext('2d')!
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  stamp.render(c, { title: 'WWWWWWWWWWWWWW', value: 'WWWWW' })
  expect(fr.mock.calls.length).toBeGreaterThan(50)
  for (const [x, y, w, h] of fr.mock.calls) {
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + w).toBeLessThanOrEqual(96)
    expect(y + h).toBeLessThanOrEqual(123)
  }
  fr.mockRestore()
})
