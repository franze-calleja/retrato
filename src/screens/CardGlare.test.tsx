import { fireEvent, render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { getEdition } from '../editions/registry'
import { getTemplate } from '../templates/registry'
import { CardGlare } from './CardGlare'

test('pointer position drives the glare and lights it up', () => {
  const { container } = render(<CardGlare template={getTemplate('stamp')} edition={getEdition('holo')}><div /></CardGlare>)
  const wrap = container.querySelector<HTMLElement>('.card-glare')!
  vi.spyOn(wrap, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 100 } as DOMRect)
  fireEvent.pointerMove(wrap, { clientX: 50, clientY: 75 })
  expect(wrap.style.getPropertyValue('--gx')).toBe('25%')
  expect(wrap.style.getPropertyValue('--gy')).toBe('75%')
  expect(wrap.hasAttribute('data-active')).toBe(true)
  fireEvent.pointerLeave(wrap)
  expect(wrap.hasAttribute('data-active')).toBe(false)
})

test('variant and sparkles follow the edition', () => {
  const { container, rerender } = render(<CardGlare template={getTemplate('stamp')} edition={getEdition('poly')}><div /></CardGlare>)
  expect(container.querySelector('.card-glare')!.getAttribute('data-glare')).toBe('poly')
  expect(container.querySelectorAll('.glare .sparkle-dot')).toHaveLength(6)
  rerender(<CardGlare template={getTemplate('stamp')} edition={getEdition('foil')}><div /></CardGlare>)
  expect(container.querySelector('.card-glare')!.getAttribute('data-glare')).toBe('foil')
  expect(container.querySelectorAll('.glare .sparkle-dot')).toHaveLength(0)
})

test('a zero-size card (not laid out yet) does not produce NaN', () => {
  const { container } = render(<CardGlare template={getTemplate('stamp')} edition={getEdition('common')}><div /></CardGlare>)
  const wrap = container.querySelector<HTMLElement>('.card-glare')!
  fireEvent.pointerMove(wrap, { clientX: 5, clientY: 5 })
  expect(wrap.style.getPropertyValue('--gx')).not.toMatch(/NaN/)
})
