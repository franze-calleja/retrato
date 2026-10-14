import { fireEvent, render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { TiltCard } from './TiltCard'

test('sway motion for packs, bob by default', () => {
  const { container, rerender } = render(<TiltCard>x</TiltCard>)
  expect(container.querySelector('.tilt-inner')!.classList.contains('sway')).toBe(false)
  rerender(<TiltCard motion="sway">x</TiltCard>)
  expect(container.querySelector('.tilt-inner')!.classList.contains('sway')).toBe(true)
})

test('pointer tilt also exposes unitless --tilt-x/--tilt-y for shadows', () => {
  const { container } = render(<TiltCard>x</TiltCard>)
  const tilt = container.querySelector<HTMLElement>('.tilt')!
  vi.spyOn(tilt, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect)
  fireEvent.pointerMove(tilt, { clientX: 100, clientY: 50 })
  expect(tilt.style.getPropertyValue('--tilt-x')).toBe('10')
  expect(tilt.style.getPropertyValue('--tilt-y')).toBe('0')
  fireEvent.pointerLeave(tilt)
  expect(tilt.style.getPropertyValue('--tilt-x')).toBe('0')
})
