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
