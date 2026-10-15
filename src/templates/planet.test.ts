import { afterEach, expect, test, vi } from 'vitest'
import { CARD_WHITE, CREAM, SHADOW, TEAL, TEAL_DARK, TEAL_INK, TEAL_LIGHT } from './colors'
import { css } from './draw'
import { getTemplate } from './registry'

afterEach(() => vi.restoreAllMocks())

test('teal palette only', () => {
  const sets: string[] = []
  const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle')!
  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillStyle', 'set').mockImplementation(function (this: CanvasRenderingContext2D, v: string | CanvasGradient | CanvasPattern) {
    sets.push(String(v))
    desc.set!.call(this, v)
  })
  getTemplate('planet').render(document.createElement('canvas').getContext('2d')!, { planet: 'SATURN', effect: 'LVL 7 SHINE' })
  expect(sets.length).toBeGreaterThan(0)
  const allowed = new Set([TEAL, TEAL_LIGHT, TEAL_DARK, TEAL_INK, CARD_WHITE, CREAM, SHADOW].map(css))
  expect(sets.filter((s) => !allowed.has(s))).toEqual([])
})

test('round photo window moved under the name pill; print size unchanged', () => {
  const t = getTemplate('planet')
  expect(t.photoRect).toEqual({ x: 22, y: 34, w: 52, h: 52 })
  expect(t.photoShape).toBe('circle')
  expect(t.printSizeMm.w).toBe(63)
})

test('long names and stats fit their slots; no holes', async () => {
  const font = await import('./pixelFontLarge')
  const spy = vi.spyOn(font, 'drawTitle')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  getTemplate('planet').render(document.createElement('canvas').getContext('2d')!, { planet: 'W'.repeat(10), effect: 'W'.repeat(16) })
  const i = spy.mock.calls.findIndex((c) => c[1] === 'W'.repeat(10))
  const { width } = spy.mock.results[i].value as { width: number }
  expect(width).toBeLessThanOrEqual(64)
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 96 * 132)).toEqual([])
})
