import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { templates } from '../templates/registry'
import { Shop } from './Shop'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('every card is a button described by its info box', () => {
  render(<Shop />)
  for (const t of templates) {
    const button = screen.getByRole('button', { name: t.name })
    const infoId = button.getAttribute('aria-describedby')!
    expect(document.getElementById(infoId)?.textContent).toBe(t.description)
    expect(document.getElementById(infoId)?.getAttribute('role')).toBe('tooltip')
  }
})

test('choosing a card opens the booth for it', () => {
  render(<Shop />)
  fireEvent.click(screen.getByRole('button', { name: 'Ticket' }))
  expect([useBooth.getState().screen, useBooth.getState().templateId, useBooth.getState().mode]).toEqual(['booth', 'ticket', 'single'])
})

test('the booster pack starts pack mode and has its own info box', () => {
  render(<Shop />)
  const pack = screen.getByRole('button', { name: 'Booster Pack' })
  expect(document.getElementById(pack.getAttribute('aria-describedby')!)?.textContent).toMatch(/keep 1/i)
  fireEvent.click(pack)
  expect([useBooth.getState().screen, useBooth.getState().mode]).toEqual(['booth', 'pack'])
})

test('odds panel follows the operator settings', () => {
  useOperator.getState().setWeight('common', 0)
  useOperator.getState().setWeight('foil', 0)
  useOperator.getState().setWeight('holo', 1)
  useOperator.getState().setWeight('poly', 1)
  render(<Shop />)
  expect(screen.getByTestId('odds-holo').textContent).toBe('50%')
  expect(screen.getByTestId('odds-common').textContent).toBe('0%')
})
