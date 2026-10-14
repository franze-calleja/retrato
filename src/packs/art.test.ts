import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { PACK_ART_SIZE, packArt } from './packArt'
import { packViewfinder } from './viewfinder'

test('viewfinder has a 3:4 photo window inside the frame and is not selectable', () => {
  const r = packViewfinder.photoRect
  expect(r.w / r.h).toBeCloseTo(3 / 4)
  expect(r.x + r.w).toBeLessThanOrEqual(packViewfinder.size.w)
  expect(r.y + r.h).toBeLessThanOrEqual(packViewfinder.size.h)
  expect(templates.some((t) => t.id === packViewfinder.id)).toBe(false)
  expect(() => packViewfinder.render(document.createElement('canvas').getContext('2d')!, {})).not.toThrow()
})

test('pack art is its art size × scale and draws into a target', () => {
  const c = packArt(3)
  expect([c.width, c.height]).toEqual([PACK_ART_SIZE.w * 3, PACK_ART_SIZE.h * 3])
  const target = document.createElement('canvas')
  expect(packArt(2, target)).toBe(target)
})
