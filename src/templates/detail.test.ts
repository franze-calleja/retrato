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
  const rot = vi.spyOn(c, 'rotate')
  const vertical = rects((cc) => drawTextVertical(cc, 'NO. 123', 5, 60, C, 'small')).length
  const horizontal = rects((cc) => drawText(cc, 'NO. 123', 0, 0, C)).length
  expect(vertical).toBe(horizontal)
  drawTextVertical(c, 'A', 0, 10, C, 'big')
  expect(rot).toHaveBeenCalledWith(-Math.PI / 2)
})
