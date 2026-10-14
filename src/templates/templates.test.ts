import { describe, expect, test } from 'vitest'
import { clampValue, refreshPerCapture, resolveDefaults } from './fields'
import { placeholderPhoto } from './placeholder'
import { getTemplate, templates } from './registry'

describe.each(templates.map((t) => [t.id, t] as const))('template %s', (_id, t) => {
  test('photoRect lies inside the template', () => {
    const r = t.photoRect
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(t.size.w)
    expect(r.y + r.h).toBeLessThanOrEqual(t.size.h)
  })

  test('field keys are unique and defaults fit maxLength', () => {
    const keys = t.fields.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
    const defaults = resolveDefaults(t)
    for (const f of t.fields) {
      expect(Array.from(defaults[f.key]).length, f.key).toBeLessThanOrEqual(f.maxLength)
    }
  })

  test('has a one-line description for the shop', () => {
    expect(t.description.trim().length).toBeGreaterThan(0)
    expect(t.description).not.toMatch(/\n/)
  })

  test('renders with defaults, max-length junk, and empty values without throwing', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    expect(() => t.render(ctx, resolveDefaults(t))).not.toThrow()
    const junk = Object.fromEntries(t.fields.map((f) => [f.key, 'é😀w'.repeat(f.maxLength).slice(0, f.maxLength)]))
    expect(() => t.render(ctx, junk)).not.toThrow()
    expect(() => t.render(ctx, {})).not.toThrow()
  })
})

describe('registry', () => {
  test('ids are unique and getTemplate finds each one', () => {
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(getTemplate(id).id).toBe(id)
  })
  test('getTemplate throws on unknown id', () => {
    expect(() => getTemplate('nope')).toThrow(/unknown template/i)
  })
})

describe('fields', () => {
  test('clampValue limits by code points, not UTF-16 units', () => {
    const f = { key: 'k', label: 'K', default: '', maxLength: 3 }
    expect(clampValue(f, 'ABCDEF')).toBe('ABC')
    expect(clampValue(f, '😀😀😀😀')).toBe('😀😀😀')
  })
  test('refreshPerCapture keeps non-per-capture values', () => {
    const t = getTemplate('stamp')
    expect(refreshPerCapture(t, { ...resolveDefaults(t), title: 'MY EVENT' }).title).toBe('MY EVENT')
  })
})

describe('placeholderPhoto', () => {
  test('is photoRect × 4 and unmirrored', () => {
    const t = getTemplate('stamp')
    const p = placeholderPhoto(t)
    expect([p.w, p.h]).toEqual([t.photoRect.w * 4, t.photoRect.h * 4])
    expect(p.mirror).toBeUndefined()
  })
})

test('every card prints with the same proportions as its art (within 0.1%)', () => {
  for (const t of templates) {
    const art = t.size.w / t.size.h
    const print = t.printSizeMm.w / t.printSizeMm.h
    expect(Math.abs(print / art - 1), t.id).toBeLessThan(0.001)
  }
})

describe('fitEdit', () => {
  test('typing mid-field in a full field drops the new character, not the last one', async () => {
    const { fitEdit } = await import('./fields')
    expect(fitEdit('ABCXDEFGHIJKLMN', 4, 14)).toBe('ABCDEFGHIJKLMN')
  })
  test('select-all then paste longer text keeps as much as fits', async () => {
    const { fitEdit } = await import('./fields')
    expect(fitEdit('VIP-PASS-2026', 13, 10)).toBe('VIP-PASS-2')
  })
  test('replacing 2 characters with 3 in a full field trims just before the caret', async () => {
    const { fitEdit } = await import('./fields')
    // 'NO. 123456' with '12' replaced by 'ABC' → 'NO. ABC3456' (11), caret after C
    expect(fitEdit('NO. ABC3456', 7, 10)).toBe('NO. AB3456')
  })
  test('counts emoji as one character', async () => {
    const { fitEdit } = await import('./fields')
    expect(fitEdit('😀😀x😀😀😀', 5, 5)).toBe('😀😀😀😀😀')
  })
})
