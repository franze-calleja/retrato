import { afterEach, expect, test, vi } from 'vitest'
import { PACKS } from '../packs/catalog'
import { packViewfinder } from '../packs/viewfinder'
import { templates } from '../templates/registry'
import { drawLiveCrop, screenSize } from './liveCrop'

afterEach(() => vi.restoreAllMocks())

const all = [...templates, ...PACKS.map(packViewfinder)]
const photo = (mirror = false) => ({ source: document.createElement('canvas'), w: 1280, h: 720, mirror })

test.each(all.map((t) => [t.id, t] as const))('%s screen has the photo window aspect', (_id, t) => {
  const { w, h } = screenSize(t, 240)
  expect(w).toBe(240)
  expect(w / h).toBeCloseTo(t.photoRect.w / t.photoRect.h, 1)
})

test.each(all.map((t) => [t.id, t] as const))('%s crop fills the screen; shaped windows clip', (_id, t) => {
  const canvas = document.createElement('canvas')
  const { w, h } = screenSize(t, 240)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const draw = vi.spyOn(ctx, 'drawImage')
  const clip = vi.spyOn(ctx, 'clip')
  drawLiveCrop(ctx, photo(), t, w, h)
  expect(draw.mock.calls.at(-1)!.slice(5)).toEqual([0, 0, w, h])
  expect(clip).toHaveBeenCalledTimes((t.photoShape ?? 'rect') === 'rect' ? 0 : 1)
})

test('camera sources are mirrored like the booth preview', () => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const scale = vi.spyOn(ctx, 'scale')
  drawLiveCrop(ctx, photo(true), templates[0], 100, 120)
  expect(scale).toHaveBeenCalledWith(-1, 1)
})
