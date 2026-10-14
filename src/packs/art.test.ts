import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { PACKS } from './catalog'
import { PACK_ART_SIZE, packArt } from './packArt'
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
