import { expect, test, vi } from 'vitest'
import { getEdition } from '../editions/registry'
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

test('reuses the rendered frame art when template and values are unchanged (live preview runs every frame)', () => {
  const render = vi.spyOn(t, 'render')
  const values = { title: 'CACHE ME', value: '1¢' }
  composeStamp(t, photo, values, 4)
  composeStamp(t, photo, { ...values }, 4)
  expect(render).toHaveBeenCalledTimes(1)
  composeStamp(t, photo, { ...values, title: 'CHANGED' }, 4)
  expect(render).toHaveBeenCalledTimes(2)
  render.mockRestore()
})

test('edition overlay is applied before the photo, and the photo is drawn last into photoRect × scale', () => {
  const holo = getEdition('holo')
  const overlay = vi.spyOn(holo, 'overlay')
  const target = document.createElement('canvas')
  const ctx = target.getContext('2d')!
  const drawImage = vi.spyOn(ctx, 'drawImage')
  composeStamp(t, photo, { title: 'EDITION ORDER' }, 4, target, { edition: holo, angle: 0.2 })
  expect(overlay).toHaveBeenCalled()
  const last = drawImage.mock.calls.at(-1)!
  const r = t.photoRect
  expect(last[0]).toBe(photo.source)
  expect(last.slice(5)).toEqual([r.x * 4, r.y * 4, r.w * 4, r.h * 4])
  overlay.mockRestore()
})

test('art cache distinguishes edition and quantized angle', () => {
  const render = vi.spyOn(t, 'render')
  const values = { title: 'CACHE EDITION' }
  const holo = getEdition('holo')
  composeStamp(t, photo, values, 1, undefined, { edition: holo, angle: 0.1 })
  composeStamp(t, photo, values, 1, undefined, { edition: holo, angle: 0.1004 })
  expect(render).toHaveBeenCalledTimes(1)
  composeStamp(t, photo, values, 1, undefined, { edition: holo, angle: 0.6 })
  expect(render).toHaveBeenCalledTimes(2)
  composeStamp(t, photo, values, 1, undefined, { edition: getEdition('foil'), angle: 0.6 })
  expect(render).toHaveBeenCalledTimes(3)
  render.mockRestore()
})

test('common edition ignores angle for caching', () => {
  const render = vi.spyOn(t, 'render')
  const values = { title: 'CACHE COMMON' }
  composeStamp(t, photo, values, 1, undefined, { edition: getEdition('common'), angle: 0.1 })
  composeStamp(t, photo, values, 1, undefined, { edition: getEdition('common'), angle: 0.9 })
  expect(render).toHaveBeenCalledTimes(1)
  render.mockRestore()
})
