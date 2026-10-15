import { afterEach, expect, test, vi } from 'vitest'
import { refreshPerCapture, resolveDefaults } from './fields'
import { getTemplate } from './registry'
import { rollStat, statValue } from './trading'

afterEach(() => vi.restoreAllMocks())

test('rollStat gives 1–9 across the whole random range', () => {
  expect(rollStat(() => 0)).toBe('1')
  expect(rollStat(() => 0.5)).toBe('5')
  expect(rollStat(() => 0.9999)).toBe('9')
})

test('statValue reads digits and clamps; anything else is 0 pips', () => {
  expect(statValue('7')).toBe(7)
  expect(statValue('0')).toBe(0)
  expect(statValue('x')).toBe(0)
  expect(statValue('')).toBe(0)
  expect(statValue('-3')).toBe(0)
  expect(statValue('99')).toBe(9)
})

test('stats roll on every capture; name and type are kept', () => {
  const t = getTemplate('trading')
  const values = { ...resolveDefaults(t), name: 'ALEX', type: 'DJ', charm: 'x', chaos: 'x', luck: 'x' }
  const next = refreshPerCapture(t, values)
  expect(next.name).toBe('ALEX')
  expect(next.type).toBe('DJ')
  for (const k of ['charm', 'chaos', 'luck']) expect(next[k]).toMatch(/^[1-9]$/)
})

test('prints at trading-card size with the art aspect ratio', () => {
  const t = getTemplate('trading')
  expect(t.printSizeMm.w).toBe(63)
  expect(t.printSizeMm.h / t.printSizeMm.w).toBeCloseTo(t.size.h / t.size.w, 2)
})

test('card numbers look like 042/100 and stay in 001–100', async () => {
  const { randomCardNo } = await import('./trading')
  expect(randomCardNo(() => 0)).toBe('001/100')
  expect(randomCardNo(() => 0.4199)).toBe('042/100')
  expect(randomCardNo(() => 0.9999)).toBe('100/100')
})

test('the trading card has a per-capture Card no. field that fits its slot', () => {
  const t = getTemplate('trading')
  const f = t.fields.find((x) => x.key === 'number')!
  expect(f).toMatchObject({ label: 'Card no.', maxLength: 9, perCapture: true })
  expect(resolveDefaults(t).number).toMatch(/^\d{3}\/100$/)
  // The number's pixels = what a render with a number draws beyond the same render without one.
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const base = { ...resolveDefaults(t), charm: '5', chaos: '5', luck: '5' }
  t.render(document.createElement('canvas').getContext('2d')!, { ...base, number: '' })
  const without = new Set(fr.mock.calls.map((c) => c.join(',')))
  fr.mockClear()
  t.render(document.createElement('canvas').getContext('2d')!, { ...base, number: 'WWWWWWWWW' })
  const row = fr.mock.calls.filter((c) => !without.has(c.join(','))).map(([x, y, w, h]) => ({ x, y, w, h }))
  expect(row.length).toBeGreaterThan(0)
  for (const r of row) {
    expect(r.x).toBeGreaterThanOrEqual(36) // clear of the edition badge on the left
    expect(r.x + r.w).toBeLessThanOrEqual(90)
    expect(r.y).toBeGreaterThanOrEqual(122)
    expect(r.y + r.h).toBeLessThanOrEqual(130)
  }
})

test('trading card keeps photo and print size, draws nothing in the photo, no holes', () => {
  const t = getTemplate('trading')
  expect(t.photoRect).toEqual({ x: 10, y: 22, w: 76, h: 64 })
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  t.render(document.createElement('canvas').getContext('2d')!, { name: 'W'.repeat(12), type: 'W'.repeat(16), charm: '9', chaos: '9', luck: '9', number: '100/100' })
  const P = t.photoRect
  // Texture under the mat is painted over by it; only what is drawn after the mat could show over the photo.
  const mat = fr.mock.calls.findIndex(([x, y, w, h]) => x === P.x - 3 && y === P.y - 2 && w === P.w + 6 && h === P.h + 4)
  expect(mat).toBeGreaterThan(0)
  const bad = fr.mock.calls.slice(mat + 1).filter(([x, y, w, h]) => w < 80 && x < P.x + P.w && x + w > P.x && y < P.y + P.h && y + h > P.y)
  expect(bad).toEqual([])
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 96 * 134)).toEqual([])
})
