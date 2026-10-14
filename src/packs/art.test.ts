import { expect, test, vi } from 'vitest'
import { templates } from '../templates/registry'
import { PACKS } from './catalog'
import { PACK_ART_SIZE, TEAR_ROW, packArt, packArtParts } from './packArt'
import { packViewfinder } from './viewfinder'

test.each(PACKS.map((p) => [p.id, p] as const))('%s viewfinder: 3:4 window, named after the pack, not selectable', (_id, pack) => {
  const v = packViewfinder(pack)
  const r = v.photoRect
  expect(r.w / r.h).toBeCloseTo(3 / 4)
  expect(r.x + r.w).toBeLessThanOrEqual(v.size.w)
  expect(r.y + r.h).toBeLessThanOrEqual(v.size.h)
  expect(v.name).toBe(pack.name)
  expect(packViewfinder(pack)).toBe(v)
  expect(templates.some((t) => t.id === v.id)).toBe(false)
  expect(() => v.render(document.createElement('canvas').getContext('2d')!, {})).not.toThrow()
})

test.each(PACKS.map((p) => [p.id, p] as const))('%s wrapper art is its art size × scale', (_id, pack) => {
  const c = packArt(pack, 3)
  expect([c.width, c.height]).toEqual([PACK_ART_SIZE.w * 3, PACK_ART_SIZE.h * 3])
  const target = document.createElement('canvas')
  expect(packArt(pack, 2, target)).toBe(target)
})

test.each(PACKS.map((p) => [p.id, p] as const))('%s splits into a top strip and a body that stack to the full art', (_id, pack) => {
  const draw = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage')
  const { top, body } = packArtParts(pack, 3)
  expect([top.width, body.width]).toEqual([PACK_ART_SIZE.w * 3, PACK_ART_SIZE.w * 3])
  expect(top.height).toBe(TEAR_ROW * 3)
  expect(top.height + body.height).toBe(PACK_ART_SIZE.h * 3)
  // Both parts copy their rows from the full art at the same scale.
  const copies = draw.mock.calls.filter((c) => c.length === 9).map((c) => c.slice(1))
  expect(copies).toContainEqual([0, 0, top.width, top.height, 0, 0, top.width, top.height])
  expect(copies).toContainEqual([0, top.height, body.width, body.height, 0, 0, body.width, body.height])
  draw.mockRestore()
})

test('packArtParts draws into given canvases', () => {
  const targets = { top: document.createElement('canvas'), body: document.createElement('canvas') }
  expect(packArtParts(PACKS[0], 2, targets)).toEqual(targets)
})
