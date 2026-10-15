import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => vi.restoreAllMocks())
import { refreshPerCapture, resolveDefaults } from './fields'
import { getTemplate } from './registry'
import { randomSerial, todayIso } from './ticket'

test('todayIso uses the local date as YYYY-MM-DD', () => {
  expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
})

test('randomSerial is "NO. " + 6 zero-padded digits', () => {
  expect(randomSerial(() => 0)).toBe('NO. 000000')
  expect(randomSerial(() => 0.000123)).toBe('NO. 000123')
  expect(randomSerial(() => 0.9999999)).toBe('NO. 999999')
})

test('ticket serial regenerates per capture; event name is kept', () => {
  const t = getTemplate('ticket')
  const next = refreshPerCapture(t, { ...resolveDefaults(t), event: 'GRAD NIGHT', serial: 'NO. 111111' })
  expect(next.event).toBe('GRAD NIGHT')
  expect(next.serial).toMatch(/^NO\. \d{6}$/)
})


test('ADMIT ONE on its red ribbon meets large-text contrast (WCAG ≥ 3)', async () => {
  const { CREAM, RED } = await import('./colors')
  const lum = (c: readonly number[]) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [hi, lo] = [lum(CREAM), lum(RED)].sort((a, b) => b - a)
  expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(3)
})

test('a full 10-character serial is printed whole down the stub', async () => {
  const detail = await import('./detail')
  const spy = vi.spyOn(detail, 'drawTextVertical')
  const t = getTemplate('ticket')
  try {
    t.render(document.createElement('canvas').getContext('2d')!, { ...resolveDefaults(t), serial: '1234567890' })
    expect(spy.mock.calls[0][1]).toBe('1234567890')
  } finally {
    spy.mockRestore()
  }
})

test('the ticket has a Seat field after Date', () => {
  const keys = getTemplate('ticket').fields.map((f) => f.key)
  expect(keys).toEqual(['event', 'date', 'seat', 'serial'])
  expect(resolveDefaults(getTemplate('ticket')).seat).toBe('ROW A SEAT 07')
})

test('the serial runs down the stub, clear of the edition badge', async () => {
  const detail = await import('./detail')
  const spy = vi.spyOn(detail, 'drawTextVertical')
  const t = getTemplate('ticket')
  const c = document.createElement('canvas').getContext('2d')!
  t.render(c, { ...resolveDefaults(t), serial: 'NO. 123456' })
  expect(spy).toHaveBeenCalled()
  const [, text, , y] = spy.mock.calls[0]
  spy.mockRestore()
  expect(text).toBe('NO. 123456')
  expect(y).toBeLessThanOrEqual(76 - 9) // badge sits in the bottom 9 px of the stub
})

test('the ticket only cuts notches at its edges and the stub line — no holes in the body', () => {
  const clear = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  const t = getTemplate('ticket')
  try {
    t.render(document.createElement('canvas').getContext('2d')!, resolveDefaults(t))
    const BW = 188
    const BH = 76
    const STUB = 148
    const interior = clear.mock.calls.filter(([x, y, w, h]) => {
      const atEdge = x <= 3 || x + w >= BW - 3 || y <= 3 || y + h >= BH - 3
      const atStub = x >= STUB - 2 && x + w <= STUB + 3
      return !atEdge && !atStub && w * h < BW * BH
    })
    expect(interior).toEqual([])
  } finally {
    clear.mockRestore()
  }
})
