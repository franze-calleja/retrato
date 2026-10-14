import { describe, expect, test, vi } from 'vitest'
import { panel, withDropShadow } from './draw'
import { GLYPHS, drawText, fitScale, glyphFor, measureText } from './pixelFont'

describe('glyph table', () => {
  test('every glyph is 5 rows of 3 binary columns', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(5)
      for (const row of rows) expect(row, ch).toMatch(/^[01]{3}$/)
    }
  })
  test('covers A–Z, 0–9 and the cent sign', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789¢') expect(GLYPHS[ch], ch).toBeDefined()
  })
})

describe('glyphFor', () => {
  test('is case-insensitive', () => {
    expect(glyphFor('a')).toBe(GLYPHS.A)
  })
  test('falls back to ? for unknown characters', () => {
    expect(glyphFor('é')).toBe(GLYPHS['?'])
    expect(glyphFor('😀')).toBe(GLYPHS['?'])
  })
})

describe('measureText', () => {
  test('3px glyph + 1px gap, no trailing gap', () => {
    expect(measureText('')).toBe(0)
    expect(measureText('A')).toBe(3)
    expect(measureText('AB')).toBe(7)
    expect(measureText('AB', 2)).toBe(14)
  })
  test('counts an emoji as one character', () => {
    expect(measureText('😀')).toBe(3)
  })
})

describe('fitScale', () => {
  test('returns the largest scale that fits', () => {
    expect(fitScale('HI', 20, 2)).toBe(2)
    expect(fitScale('HELLO', 20, 2)).toBe(1)
    expect(fitScale('WAY TOO LONG TEXT', 10, 2)).toBe(1)
  })
})

describe('drawText', () => {
  test('does not throw on lowercase, accents, emoji, empty text, or with a shadow', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    expect(() => drawText(ctx, 'héllo 😀 wörld', 0, 0, [0, 0, 0])).not.toThrow()
    expect(() => drawText(ctx, '', 0, 0, [0, 0, 0], 2)).not.toThrow()
    expect(() => drawText(ctx, 'HI', 0, 0, [255, 255, 255], 2, [0, 0, 0, 0.5])).not.toThrow()
  })
  test('shadow draws each lit glyph pixel twice', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const fillRect = vi.spyOn(ctx, 'fillRect')
    drawText(ctx, 'I', 0, 0, [255, 255, 255])
    const plain = fillRect.mock.calls.length
    fillRect.mockClear()
    drawText(ctx, 'I', 0, 0, [255, 255, 255], 1, [0, 0, 0])
    expect(fillRect.mock.calls.length).toBe(plain * 2)
  })
})

describe('draw helpers', () => {
  test('panel and withDropShadow do not throw', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    expect(() => panel(ctx, [1, 2, 3], 0, 0, 20, 10, 3)).not.toThrow()
    expect(() => withDropShadow(ctx, 20, 10, 2, [0, 0, 0, 0.4], (c) => panel(c, [9, 9, 9], 0, 0, 20, 10))).not.toThrow()
  })
})

test('letters that grow when uppercased (ß, ﬁ) still take one slot', () => {
  expect(measureText('ß')).toBe(measureText('A'))
  expect(measureText('ﬁx')).toBe(measureText('AB'))
})
