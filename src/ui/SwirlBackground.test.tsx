import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SwirlBackground } from './SwirlBackground'

test('renders a decorative canvas and survives missing WebGL', () => {
  const { container } = render(<SwirlBackground />)
  const canvas = container.querySelector('canvas.swirl')
  expect(canvas).not.toBeNull()
  expect(canvas?.getAttribute('aria-hidden')).toBe('true')
})

test('takes a shop or booth palette', () => {
  const { container, rerender } = render(<SwirlBackground palette="shop" />)
  expect(container.querySelector('canvas')?.getAttribute('data-palette')).toBe('shop')
  rerender(<SwirlBackground palette="booth" />)
  expect(container.querySelector('canvas')?.getAttribute('data-palette')).toBe('booth')
})
