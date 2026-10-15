import { afterEach, expect, test, vi } from 'vitest'
import { getEdition } from '../editions/registry'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { getTemplate } from '../templates/registry'
import { composeStamp } from './composeStamp'

// Restore spies even when an assertion fails, so they never leak into later tests.
afterEach(() => vi.restoreAllMocks())

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

test('round and arched photo windows are clipped; rectangles are not', () => {
  for (const [id, clipped] of [['planet', true], ['tarot', true], ['stamp', false]] as const) {
    const tpl = getTemplate(id)
    const target = document.createElement('canvas')
    const clip = vi.spyOn(target.getContext('2d')!, 'clip')
    composeStamp(tpl, placeholderPhoto(tpl), resolveDefaults(tpl), 2, target)
    expect(clip.mock.calls.length > 0, id).toBe(clipped)
  }
})

test('a ghostRect gets a faded greyscale copy of the photo after the main photo, with state restored', () => {
  const t = { ...getTemplate('stamp'), id: 'ghost-test', ghostRect: { x: 2, y: 3, w: 10, h: 12 } }
  const photo = { source: document.createElement('canvas'), w: 100, h: 100 }
  const out = document.createElement('canvas')
  const ctx = out.getContext('2d')!
  const seen: { dest: number[]; alpha: number; filter: string }[] = []
  // Record only: the canvas mock's drawImage is shared, so calling through would recurse.
  vi.spyOn(ctx, 'drawImage').mockImplementation(((...a: unknown[]) => {
    if (a[0] === photo.source) seen.push({ dest: (a as number[]).slice(5), alpha: ctx.globalAlpha, filter: ctx.filter })
  }) as never)
  composeStamp(t, photo, {}, 4, out)
  expect(seen).toHaveLength(2)
  expect(seen[1].dest).toEqual([8, 12, 40, 48])
  expect(seen[1].alpha).toBeCloseTo(0.35)
  expect(seen[1].filter).toBe('grayscale(1)')
  expect(seen[0].alpha).toBe(1)
  expect(ctx.globalAlpha).toBe(1)
  expect(ctx.filter).toBe('none')
})

test('templates without a ghostRect draw the photo once', () => {
  const t = getTemplate('stamp')
  const photo = { source: document.createElement('canvas'), w: 100, h: 100 }
  const out = document.createElement('canvas')
  const ctx = out.getContext('2d')!
  const draw = vi.spyOn(ctx, 'drawImage')
  composeStamp(t, photo, {}, 2, out)
  expect(draw.mock.calls.filter((c) => c[0] === photo.source)).toHaveLength(1)
})

test('an overlay is drawn after the photo, and the edition badge goes on the overlay', async () => {
  const apply = await import('../editions/apply')
  const spy = vi.spyOn(apply, 'applyEdition')
  const overlay = vi.fn((ctx: CanvasRenderingContext2D) => ctx.fillRect(0, 0, 1, 1))
  const t = { ...getTemplate('stamp'), id: 'overlay-test', overlay }
  const p = { source: document.createElement('canvas'), w: 100, h: 100 }
  const out = document.createElement('canvas')
  const ctx = out.getContext('2d')!
  const order: string[] = []
  vi.spyOn(ctx, 'drawImage').mockImplementation(((src: unknown) => {
    order.push(src === p.source ? 'photo' : 'art')
  }) as never)
  composeStamp(t, p, {}, 2, out, { edition: getEdition('holo'), angle: 0.35 })
  expect(overlay).toHaveBeenCalled()
  expect(order).toEqual(['art', 'photo', 'art'])
  const badges = spy.mock.calls.map((c) => c[6]?.badge)
  expect(badges).toEqual([false, true]) // frame: no badge; overlay: badge
  spy.mockRestore()
})

test('without an overlay the frame still carries the badge', async () => {
  const apply = await import('../editions/apply')
  const spy = vi.spyOn(apply, 'applyEdition')
  const t = { ...getTemplate('stamp'), id: 'no-overlay-test' }
  composeStamp(t, { source: document.createElement('canvas'), w: 10, h: 10 }, {}, 1, undefined, { edition: getEdition('foil'), angle: 0.35 })
  expect(spy.mock.calls.map((c) => c[6]?.badge ?? true)).toEqual([true])
  spy.mockRestore()
})
