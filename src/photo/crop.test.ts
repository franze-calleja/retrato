import { describe, expect, test, vi } from 'vitest'
import { coverCrop, cropPhoto, drawCover } from './crop'

describe('coverCrop', () => {
  test('same aspect uses the whole source', () => {
    expect(coverCrop(640, 480, 64, 48)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 480 })
  })
  test('landscape source into portrait target crops the sides, centered', () => {
    const c = coverCrop(1280, 720, 72, 84)
    expect(c.sy).toBe(0)
    expect(c.sh).toBe(720)
    expect(c.sw).toBeCloseTo(617.14, 2)
    expect(c.sx).toBeCloseTo(331.43, 2)
  })
  test('portrait source into landscape target crops top and bottom, centered', () => {
    expect(coverCrop(720, 1280, 60, 30)).toEqual({ sx: 0, sy: 460, sw: 720, sh: 360 })
  })
  test('the cropped region keeps the target aspect (never stretches)', () => {
    const c = coverCrop(1000, 333, 72, 84)
    expect(c.sw / c.sh).toBeCloseTo(72 / 84, 6)
  })
})

describe('drawCover', () => {
  test('mirrors around the destination rect and restores state', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const save = vi.spyOn(ctx, 'save')
    const restore = vi.spyOn(ctx, 'restore')
    const translate = vi.spyOn(ctx, 'translate')
    const scale = vi.spyOn(ctx, 'scale')
    const src = document.createElement('canvas')
    drawCover(ctx, { source: src, w: 100, h: 100, mirror: true }, 10, 20, 30, 30)
    expect(translate).toHaveBeenCalledWith(50, 0)
    expect(scale).toHaveBeenCalledWith(-1, 1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
  })
  test('does not mirror when mirror is unset', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const scale = vi.spyOn(ctx, 'scale')
    drawCover(ctx, { source: document.createElement('canvas'), w: 10, h: 10 }, 0, 0, 10, 10)
    expect(scale).not.toHaveBeenCalled()
  })
})

describe('cropPhoto', () => {
  test('returns an unmirrored PhotoSource of the requested size', () => {
    const src = document.createElement('canvas')
    const out = cropPhoto({ source: src, w: 1280, h: 720, mirror: true }, 576, 672)
    expect(out.w).toBe(576)
    expect(out.h).toBe(672)
    expect(out.mirror).toBeUndefined()
    const canvas = out.source as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([576, 672])
  })
})
