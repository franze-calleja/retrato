import { expect, test } from 'vitest'
import { getTemplate } from './registry'
import { resolveTemplate } from './resolve'
import type { Template, TemplateVariant } from './types'

test('templates without a variant resolve to themselves', () => {
  const t = getTemplate('stamp')
  expect(resolveTemplate(t, {})).toBe(t)
})

test('a variant overrides fields and keeps a stable identity for the same variant', () => {
  const a: TemplateVariant = { photoRect: { x: 1, y: 2, w: 3, h: 4 } }
  const b: TemplateVariant = { photoRect: { x: 5, y: 6, w: 7, h: 8 } }
  const t: Template = { ...getTemplate('stamp'), id: 'variant-test', variant: (v) => (v.k === 'b' ? b : a) }
  const ra = resolveTemplate(t, { k: 'a' })
  expect(ra.photoRect).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  expect(resolveTemplate(t, { k: 'a' })).toBe(ra)
  expect(resolveTemplate(t, { k: 'b' }).photoRect).toEqual({ x: 5, y: 6, w: 7, h: 8 })
})
