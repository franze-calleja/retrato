import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => vi.restoreAllMocks())
import { resolveDefaults } from './fields'
import { voucher } from './voucher'

test('expiry reads VALID UNTIL / TODAY by default', () => {
  expect(resolveDefaults(voucher).expires).toBe('TODAY')
})

test('the stub carries a round seal instead of KEEP THIS', async () => {
  const font = await import('./pixelFont')
  const texts: string[] = []
  const big = await import('./pixelFontLarge')
  const bigTexts: string[] = []
  const draw = vi.spyOn(font, 'drawTextCentered').mockImplementation((_c, t) => void texts.push(t))
  const drawBig = vi.spyOn(big, 'drawBigCentered').mockImplementation((_c, t) => void bigTexts.push(t))
  voucher.render(document.createElement('canvas').getContext('2d')!, resolveDefaults(voucher))
  expect(texts).not.toContain('KEEP')
  expect(texts).toEqual(expect.arrayContaining(['VALID UNTIL', 'RETRATO']))
  expect(bigTexts).toEqual(expect.arrayContaining(['★', 'R']))
  draw.mockRestore()
  drawBig.mockRestore()
})

test('long text stays inside the card', () => {
  const spy = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  voucher.render(document.createElement('canvas').getContext('2d')!, { title: 'W'.repeat(14), amount: 'W'.repeat(12), expires: 'W'.repeat(14) })
  for (const [x, y, w, h] of spy.mock.calls) {
    expect(x + w).toBeLessThanOrEqual(191)
    expect(y + h).toBeLessThanOrEqual(95)
  }
  spy.mockRestore()
})
