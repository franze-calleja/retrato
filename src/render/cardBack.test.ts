import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { cardBack } from './cardBack'

test.each(templates.map((t) => [t.id, t] as const))('%s card back is template size × scale', (_id, t) => {
  const c = cardBack(t, 3)
  expect([c.width, c.height]).toEqual([t.size.w * 3, t.size.h * 3])
})

test('draws into a provided target', () => {
  const target = document.createElement('canvas')
  expect(cardBack(templates[0], 2, target)).toBe(target)
})
