import { expect, test, vi } from 'vitest'
import { bevel, cornerOrnaments, dither, drawTextVertical, guilloche, hatch, postmark, ring } from './detail'
import { drawText } from './pixelFont'

const R = { x: 10, y: 20, w: 40, h: 30 }
const C: [number, number, number] = [1, 2, 3]
function rects(draw: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas').getContext('2d')!
  const fr = vi.spyOn(c, 'fillRect')
  draw(c)
  return fr.mock.calls.map(([x, y, w, h]) => ({ x, y, w, h }))
}
const insideR = (p: { x: number; y: number; w: number; h: number }) =>
  p.x >= R.x && p.y >= R.y && p.x + p.w <= R.x + R.w && p.y + p.h <= R.y + R.h

test.each([
  ['bevel', (c: CanvasRenderingContext2D) => bevel(c, R, C, C)],
  ['dither', (c: CanvasRenderingContext2D) => dither(c, R, C, 0.3, 1)],
  ['hatch', (c: CanvasRenderingContext2D) => hatch(c, R, C, 2)],
  ['cornerOrnaments', (c: CanvasRenderingContext2D) => cornerOrnaments(c, R, C)],
  ['guilloche', (c: CanvasRenderingContext2D) => guilloche(c, R, C, 16, 2)],
])('%s paints only inside its rect', (_n, draw) => {
  const out = rects(draw)
  expect(out.length).toBeGreaterThan(0)
  expect(out.every(insideR)).toBe(true)
})

test('dither is deterministic per seed', () => {
  const a = rects((c) => dither(c, R, C, 0.3, 1))
  expect(rects((c) => dither(c, R, C, 0.3, 1))).toEqual(a)
  expect(rects((c) => dither(c, R, C, 0.3, 2))).not.toEqual(a)
})

test('ring pixels lie on the circle', () => {
  for (const p of rects((c) => ring(c, 50, 50, 10, C))) {
    const d = Math.hypot(p.x - 50, p.y - 50)
    expect(Math.abs(d - 10)).toBeLessThanOrEqual(1)
  }
})

test('ring and postmark skip the avoid rect (the photo window)', () => {
  const avoid = { x: 40, y: 40, w: 30, h: 30 }
  for (const draw of [(c: CanvasRenderingContext2D) => ring(c, 50, 50, 12, C, avoid), (c: CanvasRenderingContext2D) => postmark(c, 50, 50, 12, C, avoid)])
    for (const p of rects(draw)) {
      const hit = p.x < avoid.x + avoid.w && p.x + p.w > avoid.x && p.y < avoid.y + avoid.h && p.y + p.h > avoid.y
      expect(hit).toBe(false)
    }
})

test('vertical text draws the same pixels as horizontal text, rotated a quarter turn', () => {
  const c = document.createElement('canvas').getContext('2d')!
  const tf = vi.spyOn(c, 'transform')
  const vertical = rects((cc) => drawTextVertical(cc, 'NO. 123', 5, 60, C, 'small')).length
  const horizontal = rects((cc) => drawText(cc, 'NO. 123', 0, 0, C)).length
  expect(vertical).toBe(horizontal)
  drawTextVertical(c, 'A', 3, 10, C, 'big')
  // local (u, v) → screen (3 + v, 10 − u): an exact quarter turn anchored at the bottom-left
  expect(tf).toHaveBeenCalledWith(0, -1, 1, 0, 3, 10)
})

test('texture helpers set the colour once instead of per pixel', () => {
  const c = document.createElement('canvas').getContext('2d')!
  let sets = 0
  const proto = Object.getPrototypeOf(c)
  const desc = Object.getOwnPropertyDescriptor(proto, 'fillStyle')!
  Object.defineProperty(c, 'fillStyle', { configurable: true, get: () => desc.get!.call(c), set: (v) => (sets++, desc.set!.call(c, v)) })
  dither(c, { x: 0, y: 0, w: 60, h: 60 }, C, 0.5, 3)
  guilloche(c, { x: 0, y: 0, w: 60, h: 20 }, C, 16, 2)
  expect(sets).toBe(2)
})

test('corner ornaments can skip a corner (where the edition badge sits)', () => {
  const all = rects((c) => cornerOrnaments(c, R, C)).length
  const three = rects((c) => cornerOrnaments(c, R, C, ['tr'])).length
  expect(three).toBe((all * 3) / 4)
})
