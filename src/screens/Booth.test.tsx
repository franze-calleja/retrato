import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useBooth } from '../store/booth'
import { Booth } from './Booth'

test('upload control stays in the tab order (camera fallback must be keyboard reachable)', () => {
  render(<Booth />)
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  expect(input.type).toBe('file')
  expect(input.hidden).toBe(false)
  expect(input.tabIndex).toBeGreaterThanOrEqual(0)
})

test('pack mode shows the booster pack viewfinder', () => {
  useBooth.setState({ ...useBooth.getInitialState(), mode: 'pack', screen: 'booth' }, true)
  render(<Booth />)
  expect(screen.getByRole('heading', { name: 'Booster Pack' })).toBeTruthy()
  expect(screen.getByRole('img', { name: /booster pack live preview/i })).toBeTruthy()
  useBooth.setState(useBooth.getInitialState(), true)
})
