import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { glareClip, glareVariant } from './glare'

test('glare variant follows the edition; unknown → common', () => {
  expect(['common', 'foil', 'holo', 'poly', 'nope'].map(glareVariant)).toEqual(['common', 'foil', 'holo', 'poly', 'common'])
})

test.each(templates.map((t) => [t.id, t] as const))('%s glare cuts out exactly the photo window', (_id, t) => {
  const clip = glareClip(t)
  expect(clip.startsWith('polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ')).toBe(true)
  const pts = clip.slice(clip.lastIndexOf('0% 0%, ') + 7, -1).split(', ').map((p) => p.split(' ').map((v) => parseFloat(v)))
  const { x, y, w, h } = t.photoRect
  const px = (v: number, of: number) => (v / of) * 100
  expect(pts).toHaveLength(5)
  expect(pts[0][0]).toBeCloseTo(px(x, t.size.w), 2)
  expect(pts[0][1]).toBeCloseTo(px(y, t.size.h), 2)
  expect(pts[2][0]).toBeCloseTo(px(x + w, t.size.w), 2)
  expect(pts[2][1]).toBeCloseTo(px(y + h, t.size.h), 2)
  expect(pts[4]).toEqual(pts[0])
})
