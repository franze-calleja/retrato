import { afterEach, expect, test, vi } from 'vitest'
import { refreshPerCapture, resolveDefaults } from './fields'
import { barcodeBars, randomMember, validUntil } from './idcard'
import { getTemplate } from './registry'

test('randomMember is "NO. " + 4 zero-padded digits', () => {
  expect(randomMember(() => 0)).toBe('NO. 0000')
  expect(randomMember(() => 0.0421)).toBe('NO. 0421')
  expect(randomMember(() => 0.99999)).toBe('NO. 9999')
})

test('validUntil is the same day next year; Feb 29 becomes Feb 28', () => {
  expect(validUntil(new Date(2026, 9, 14))).toBe('2027-10-14')
  expect(validUntil(new Date(2028, 1, 29))).toBe('2029-02-28')
})

test('barcode is deterministic per member number, with solid guard bars', () => {
  const a = barcodeBars('NO. 4821', 60)
  expect(a).toHaveLength(60)
  expect(barcodeBars('NO. 4821', 60)).toEqual(a)
  expect(barcodeBars('NO. 4822', 60)).not.toEqual(a)
  expect([a[0], a[1], a[58], a[59]]).toEqual([true, true, true, true])
})

test('member number rolls on every capture; org and name are kept', () => {
  const t = getTemplate('id')
  const next = refreshPerCapture(t, { ...resolveDefaults(t), org: 'ROBOTICS', name: 'SAM', member: 'NO. 1111' })
  expect(next.org).toBe('ROBOTICS')
  expect(next.name).toBe('SAM')
  expect(next.member).toMatch(/^NO\. \d{4}$/)
})

test('prints at bank-card size with the art aspect ratio', () => {
  const t = getTemplate('id')
  expect(t.printSizeMm.w).toBe(85.6)
  expect(t.printSizeMm.h / t.printSizeMm.w).toBeCloseTo(t.size.h / t.size.w, 2)
})


afterEach(() => vi.restoreAllMocks())

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

test('ID keeps its photo window and print size, and gains a ghost photo clear of everything', () => {
  const t = getTemplate('id')
  expect(t.photoRect).toEqual({ x: 8, y: 26, w: 48, h: 60 })
  expect(t.printSizeMm.w).toBe(85.6)
  expect(t.ghostRect).toEqual({ x: 136, y: 70, w: 16, h: 20 })
  expect(overlaps(t.ghostRect!, t.photoRect)).toBe(false)
  expect(t.ghostRect!.x).toBeGreaterThanOrEqual(64 + 64) // right of the text column and barcode
})

test('ID draws no detail inside the photo window and punches no holes', () => {
  const t = getTemplate('id')
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  t.render(document.createElement('canvas').getContext('2d')!, { org: 'W'.repeat(12), name: 'W'.repeat(14), member: 'NO. 9999', valid: '2099-12-31' })
  const bad = fr.mock.calls.map(([x, y, w, h]) => ({ x, y, w, h })).filter((r) => r.w < 100 && overlaps(r, t.photoRect))
  expect(bad).toEqual([])
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 160 * 101)).toEqual([])
})

test('a long name stays in its column, left of the chip', async () => {
  const font = await import('./pixelFontLarge')
  const spy = vi.spyOn(font, 'drawTitle')
  const t = getTemplate('id')
  t.render(document.createElement('canvas').getContext('2d')!, { org: '', name: 'W'.repeat(14), member: '', valid: '' })
  const i = spy.mock.calls.findIndex((c) => c[1] === 'W'.repeat(14))
  expect(i).toBeGreaterThanOrEqual(0)
  const cx = spy.mock.calls[i][2]
  const { width } = spy.mock.results[i].value as { width: number }
  expect(Math.round(cx - width / 2)).toBeGreaterThanOrEqual(64)
  expect(Math.round(cx - width / 2) + width).toBeLessThanOrEqual(130) // chip border starts at x 131
})

test('the organisation name clears the widest edition badge in the top-left corner', async () => {
  const font = await import('./pixelFontLarge')
  const { badgeRect } = await import('../editions/apply')
  const badge = badgeRect('★★ POLY')
  const t = getTemplate('id')
  for (let n = 1; n <= 12; n++) {
    const org = 'W'.repeat(n)
    const spy = vi.spyOn(font, 'drawTitle')
    t.render(document.createElement('canvas').getContext('2d')!, { org, name: '', member: '', valid: '' })
    const i = spy.mock.calls.findIndex((c) => c[1] === org)
    const cx = spy.mock.calls[i][2]
    const { width } = spy.mock.results[i].value as { width: number }
    expect(Math.round(cx - width / 2), org).toBeGreaterThanOrEqual(badge.x + badge.w + 1)
    spy.mockRestore()
  }
})
