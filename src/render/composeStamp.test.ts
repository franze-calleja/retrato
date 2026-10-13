import { expect, test, vi } from 'vitest'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { getTemplate } from '../templates/registry'
import { composeStamp } from './composeStamp'

const t = getTemplate('stamp')
const photo = placeholderPhoto(t)

test('output is template size × scale', () => {
  const c = composeStamp(t, photo, resolveDefaults(t), 8)
  expect([c.width, c.height]).toEqual([t.size.w * 8, t.size.h * 8])
})

test('draws the photo into photoRect × scale', () => {
  const target = document.createElement('canvas')
  const ctx = target.getContext('2d')!
  const drawImage = vi.spyOn(ctx, 'drawImage')
  composeStamp(t, photo, resolveDefaults(t), 8, target)
  const r = t.photoRect
  const photoCall = drawImage.mock.calls.find((c) => c[0] === photo.source)
  expect(photoCall?.slice(5)).toEqual([r.x * 8, r.y * 8, r.w * 8, r.h * 8])
})

test('draws into and returns a provided target canvas', () => {
  const target = document.createElement('canvas')
  expect(composeStamp(t, photo, resolveDefaults(t), 2, target)).toBe(target)
  expect([target.width, target.height]).toEqual([t.size.w * 2, t.size.h * 2])
})

test('can be called repeatedly (future sheet layouts)', () => {
  for (let i = 0; i < 3; i++) composeStamp(t, photo, resolveDefaults(t), 1)
})

test('rejects non-integer or non-positive scale', () => {
  expect(() => composeStamp(t, photo, {}, 1.5)).toThrow(RangeError)
  expect(() => composeStamp(t, photo, {}, 0)).toThrow(RangeError)
})
