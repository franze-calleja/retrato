import { afterEach, expect, test, vi } from 'vitest'
import { SEPIA_DARK, SEPIA_INK, SEPIA_LIGHT, SEPIA_MID, SHADOW } from './colors'
import { css } from './draw'
import { getTemplate } from './registry'
import { shapeSpans } from './shapes'

afterEach(() => vi.restoreAllMocks())

test('the tarot frame uses only the sepia palette', () => {
  const sets: string[] = []
  const proto = CanvasRenderingContext2D.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'fillStyle')!
  vi.spyOn(proto, 'fillStyle', 'set').mockImplementation(function (this: CanvasRenderingContext2D, v: string | CanvasGradient | CanvasPattern) {
    sets.push(String(v))
    desc.set!.call(this, v)
  })
  getTemplate('tarot').render(document.createElement('canvas').getContext('2d')!, { title: 'THE STAR' })
  const allowed = new Set([SEPIA_LIGHT, SEPIA_MID, SEPIA_DARK, SEPIA_INK, SHADOW].map(css))
  expect(sets.filter((s) => !allowed.has(s))).toEqual([])
})

test('tarot keeps its arched photo window and print size; nothing drawn inside the photo; no holes', () => {
  const t = getTemplate('tarot')
  expect(t.photoRect).toEqual({ x: 12, y: 24, w: 60, h: 86 })
  expect(t.photoShape).toBe('arch')
  expect(t.printSizeMm.w).toBe(70)
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  t.render(document.createElement('canvas').getContext('2d')!, { title: 'THE HIGH PRIESTESS' })
  // Texture under the arch is painted over by the mat; only fills after the rim could show over the photo.
  const rim = fr.mock.calls.length - 1 - [...fr.mock.calls].reverse().findIndex(([x, , w]) => x >= 11 && w >= 60 && w <= 62)
  const P = t.photoRect
  // (The drop-shadow pass fills the whole card on its own canvas; skip card-sized fills.)
  // Inside the arch itself (the spandrels beside its curve are frame, where the star and moon belong).
  const spans = shapeSpans(P.w, P.h, 'arch')
  const inArch = (px: number, py: number) => spans.some(([y, x0, x1]) => py === P.y + y && px >= P.x + x0 && px < P.x + x1)
  const after = fr.mock.calls.slice(rim + 1).filter(([x, y, w, h]) => {
    if (w * h >= 84 * 144) return false
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inArch(xx, yy)) return true
    return false
  })
  expect(after).toEqual([])
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 84 * 144)).toEqual([])
})

test('the longest arcana title fits whole on the plate', async () => {
  const { ARCANA } = await import('./tarot')
  const { titleFit } = await import('./pixelFontLarge')
  for (const { title } of ARCANA) expect(titleFit(title, 72, 1).text).toBe(title)
})
