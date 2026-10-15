import { expect, test, vi } from 'vitest'
import { measureText } from './pixelFont'
import { BIG_GLYPHS, bigGlyphFor, drawTitle, measureBig, titleFit } from './pixelFontLarge'

const ctx = () => document.createElement('canvas').getContext('2d')!

test('every big glyph is 7 rows of 5 binary columns', () => {
  for (const [ch, rows] of Object.entries(BIG_GLYPHS)) {
    expect(rows, ch).toHaveLength(7)
    for (const r of rows) expect(r, ch).toMatch(/^[01]{5}$/)
  }
})

test('covers A–Z, 0–9 and the listed punctuation', () => {
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?'&/:#¢★♥№ ") expect(BIG_GLYPHS[ch], ch).toBeDefined()
})

test('lowercase, ß and unknown characters', () => {
  expect(bigGlyphFor('a')).toBe(BIG_GLYPHS.A)
  expect(bigGlyphFor('ß')).toBe(BIG_GLYPHS.S)
  expect(bigGlyphFor('😀')).toBe(BIG_GLYPHS['?'])
})

test('width is (n × 6 − 1) × scale, counting code points', () => {
  expect(measureBig('AB')).toBe(11)
  expect(measureBig('AB', 2)).toBe(22)
  expect(measureBig('😀x')).toBe(11)
  expect(measureBig('')).toBe(0)
})

test('drawTitle steps down big 2 → big 1 → small, then truncates', () => {
  expect(drawTitle(ctx(), 'HI', 50, 0, 100, [0, 0, 0])).toEqual({ font: 'big', scale: 2, width: measureBig('HI', 2) })
  expect(drawTitle(ctx(), 'HELLO', 50, 0, 40, [0, 0, 0])).toEqual({ font: 'big', scale: 1, width: measureBig('HELLO') })
  const s = drawTitle(ctx(), 'HELLO THERE', 50, 0, 50, [0, 0, 0])
  expect(s).toEqual({ font: 'small', scale: 1, width: measureText('HELLO THERE') })
  const t = drawTitle(ctx(), 'W'.repeat(40), 50, 0, 30, [0, 0, 0])
  expect(t.font).toBe('small')
  expect(t.width).toBeLessThanOrEqual(30)
})

test('drawTitle never paints outside its slot', () => {
  for (const text of ['WWWWWWWWWWWWWW', 'ß😀ß😀ß😀ß😀', 'PIXEL PARTY', '']) {
    const c = ctx()
    const fr = vi.spyOn(c, 'fillRect')
    drawTitle(c, text, 50, 10, 40, [0, 0, 0], [9, 9, 9])
    for (const [x, y, w, h] of fr.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(30 - 2)
      expect(x + w).toBeLessThanOrEqual(70 + 2)
      expect(y).toBeGreaterThanOrEqual(10)
      expect(y + h).toBeLessThanOrEqual(10 + 14 + 2)
    }
  }
})

test('titleFit sizes without drawing and returns the text it would draw', () => {
  expect(titleFit('HI', 100)).toEqual({ font: 'big', scale: 2, width: measureBig('HI', 2), text: 'HI' })
  const t = titleFit('W'.repeat(40), 30)
  expect(t.font).toBe('small')
  expect(t.width).toBeLessThanOrEqual(30)
  expect(Array.from(t.text).length).toBeLessThan(40)
})
