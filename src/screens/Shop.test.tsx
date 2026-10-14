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

test.each(['Classic Pack', 'Arcana Pack', 'Cosmic Pack', 'Jester Pack'])('%s is a button with its own info box that opens that pack', (name) => {
  render(<Shop />)
  const pack = screen.getByRole('button', { name })
  expect(document.getElementById(pack.getAttribute('aria-describedby')!)?.textContent).toMatch(/keep 1/i)
  fireEvent.click(pack)
  const st = useBooth.getState()
  expect([st.screen, st.mode, st.packId]).toEqual(['booth', 'pack', name.split(' ')[0].toLowerCase()])
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

test('odds panel shows a forced edition as certain', () => {
  useOperator.getState().setForced('poly')
  render(<Shop />)
  expect(screen.getByTestId('odds-poly').textContent).toBe('100%')
  expect(screen.getByTestId('odds-common').textContent).toBe('0%')
})

test('the OPEN PACK button starts pack mode too', () => {
  render(<Shop />)
  fireEvent.click(screen.getByRole('button', { name: /open pack/i }))
  expect([useBooth.getState().screen, useBooth.getState().mode, useBooth.getState().packId]).toEqual(['booth', 'pack', 'classic'])
})

test('HOW IT WORKS expands its steps in place', () => {
  render(<Shop />)
  const toggle = screen.getByRole('button', { name: /how it works/i })
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByText('Strike a pose')).toBeNull()
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(document.getElementById(toggle.getAttribute('aria-controls')!)?.textContent).toMatch(/strike a pose/i)
})

test('the packs shelf has no placeholder slot any more', () => {
  render(<Shop />)
  expect(screen.queryByRole('img', { name: /coming soon/i })).toBeNull()
})

test('the shop has its sign and two shelves', () => {
  render(<Shop />)
  expect(screen.getByRole('heading', { name: 'SHOP' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Cards' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Packs' })).toBeTruthy()
})
