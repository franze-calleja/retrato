import { afterEach, expect, test, vi } from 'vitest'
import { PACKS } from '../packs/catalog'
import { resolveDefaults } from './fields'
import { JOKER_LAYOUTS, rollJokerLayout } from './jester'
import { getTemplate, templates } from './registry'
import { resolveTemplate } from './resolve'

afterEach(() => vi.restoreAllMocks())
const joker = () => getTemplate('jester')
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

test('the Jester card is now the Joker card, everywhere users see it', () => {
  expect(joker().name).toBe('Joker Card')
  expect(resolveDefaults(joker()).name).toBe('JOKER')
  const visible = [...templates.flatMap((t) => [t.name, t.description]), ...PACKS.flatMap((p) => [p.name, p.description])]
  expect(visible.filter((s) => /jester/i.test(s))).toEqual([])
  expect(PACKS.find((p) => p.id === 'jester')!.name).toBe('Joker Pack')
})

test('layouts roll full art a quarter of the time, else a classic theme', () => {
  expect(rollJokerLayout(() => 0)).toBe('fullart')
  expect(rollJokerLayout(() => 0.2499)).toBe('fullart')
  expect(rollJokerLayout(() => 0.25)).toBe('sunburst')
  expect(rollJokerLayout(() => 0.5)).toBe('stripes')
  expect(rollJokerLayout(() => 0.75)).toBe('stars')
  expect(rollJokerLayout(() => 0.9999)).toBe('halftone')
})

test('the layout is a per-capture select with all five layouts', () => {
  const f = joker().fields.find((x) => x.key === 'layout')!
  expect(f.perCapture).toBe(true)
  expect(f.options!.map((o) => o.value)).toEqual(['sunburst', 'stripes', 'stars', 'halftone', 'fullart'])
  expect(JOKER_LAYOUTS.map((o) => o.label)).toEqual(['Sunburst', 'Stripes', 'Starfield', 'Halftone', 'Full art'])
})

test('classic and full-art photo windows; badge top-right; unknown layout → sunburst', () => {
  const classic = resolveTemplate(joker(), { layout: 'stars' })
  const full = resolveTemplate(joker(), { layout: 'fullart' })
  expect(classic.photoRect).toEqual({ x: 18, y: 16, w: 60, h: 64 })
  expect(full.photoRect).toEqual({ x: 4, y: 4, w: 88, h: 124 })
  expect(full.overlay).toBeTypeOf('function')
  expect(classic.overlay).toBeUndefined()
  for (const t of [classic, full]) expect(t.badgeAt).toEqual({ x: 95, y: 0, align: 'right' })
  expect(resolveTemplate(joker(), { layout: 'nope' }).photoRect).toEqual(classic.photoRect)
})

test.each(['sunburst', 'stripes', 'stars', 'halftone'])('%s: theme and text never paint over the photo, no holes', (layout) => {
  const t = resolveTemplate(joker(), { layout })
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  t.render(document.createElement('canvas').getContext('2d')!, { name: 'W'.repeat(12), effect: 'W'.repeat(36), layout })
  const mat = fr.mock.calls.findIndex(([x, y, w, h]) => x === 15 && y === 14 && w === 66 && h === 68)
  expect(mat).toBeGreaterThan(0)
  const bad = fr.mock.calls.slice(mat + 1).filter(([x, y, w, h]) => w * h < 96 * 132 && overlaps({ x, y, w, h }, t.photoRect))
  expect(bad).toEqual([])
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 96 * 132)).toEqual([])
})

test('full art: the overlay only covers the corner plates and the bottom banner', () => {
  const t = resolveTemplate(joker(), { layout: 'fullart' })
  // Record each rect in screen space: the corner indices are drawn through a quarter-turn transform.
  const rects: [number, number, number, number][] = []
  const real = CanvasRenderingContext2D.prototype.fillRect
  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect').mockImplementation(function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const m = this.getTransform()
    const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f])
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    rects.push([Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)])
    return real.call(this, x, y, w, h)
  })
  t.overlay!(document.createElement('canvas').getContext('2d')!, { name: 'W'.repeat(12), effect: 'W'.repeat(36), layout: 'fullart' })
  const allowed = [{ x: 2, y: 2, w: 10, h: 25 }, { x: 84, y: 105, w: 10, h: 25 }, { x: 6, y: 100, w: 76, h: 24 }]
  expect(rects.length).toBeGreaterThan(20)
  const bad = rects.filter(([x, y, w, h]) => !allowed.some((a) => x >= a.x && y >= a.y && x + w <= a.x + a.w && y + h <= a.y + a.h))
  expect(bad).toEqual([])
})
