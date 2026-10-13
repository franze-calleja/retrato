import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SwirlBackground } from './SwirlBackground'

test('renders a decorative canvas and survives missing WebGL', () => {
  const { container } = render(<SwirlBackground />)
  const canvas = container.querySelector('canvas.swirl')
  expect(canvas).not.toBeNull()
  expect(canvas?.getAttribute('aria-hidden')).toBe('true')
})
