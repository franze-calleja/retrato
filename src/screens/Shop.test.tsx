import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { useStats } from '../store/stats'
import { templates } from '../templates/registry'
import { Shop } from './Shop'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useBooth.setState(useBooth.getInitialState(), true)
})

const seeAll = () => fireEvent.click(screen.getByRole('button', { name: /see all cards/i }))
const cardButtons = () => templates.filter((t) => screen.queryByRole('button', { name: t.name }))

test('every card is a button described by its info box', () => {
  render(<Shop />)
  seeAll()
  for (const t of templates) {
    const button = screen.getByRole('button', { name: t.name })
    const infoId = button.getAttribute('aria-describedby')!
    expect(document.getElementById(infoId)?.textContent).toBe(t.description)
    expect(document.getElementById(infoId)?.getAttribute('role')).toBe('tooltip')
  }
})

test('choosing a card opens the booth for it', () => {
  render(<Shop />)
  seeAll()
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

test('three featured cards by default; See all shows every card and can fold back', () => {
  render(<Shop />)
  expect(cardButtons()).toHaveLength(3)
  seeAll()
  expect(cardButtons()).toHaveLength(templates.length)
  const toggle = screen.getByRole('button', { name: /show featured/i })
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(toggle)
  expect(cardButtons()).toHaveLength(3)
})

test('reroll swaps in a different set of featured cards', () => {
  render(<Shop />)
  const before = cardButtons().map((t) => t.id).sort()
  fireEvent.click(screen.getByRole('button', { name: /reroll/i }))
  expect(cardButtons().map((t) => t.id).sort()).not.toEqual(before)
})

test('items carry FREE tags', () => {
  render(<Shop />)
  expect(screen.getAllByText('FREE').length).toBeGreaterThanOrEqual(3 + 4)
})

test('photos taken shows on the stat box and the deck pile', () => {
  useStats.setState({ photos: 137 })
  render(<Shop />)
  expect(screen.getByTestId('photos').textContent).toBe('137')
  expect(screen.getByRole('img', { name: '137 photos taken' })).toBeTruthy()
  useStats.setState({ photos: 0 })
})

test('the marquee sign has its tagline', () => {
  render(<Shop />)
  expect(screen.getByText('Strike a pose!')).toBeTruthy()
})

test('packs sway on the shelf; cards bob', () => {
  render(<Shop />)
  const pack = screen.getByRole('button', { name: 'Classic Pack' })
  expect(pack.closest('.tilt-inner')!.classList.contains('sway')).toBe(true)
  const card = screen.getAllByRole('button').find((b) => b.classList.contains('tile-btn') && !b.classList.contains('pack-btn'))!
  expect(card.closest('.tilt-inner')!.classList.contains('sway')).toBe(false)
})

test('each shelf item shines in turn', () => {
  render(<Shop />)
  const delays = [...document.querySelectorAll<HTMLElement>('.tile-btn')].map((b) => b.style.getPropertyValue('--glint-delay'))
  expect(delays.every((d) => /^-?\d+(\.\d+)?s$/.test(d))).toBe(true)
  // Distinct within one 7 s cycle (0 s and 7 s would shine together).
  const phases = delays.map((d) => (((parseFloat(d) % 7) + 7) % 7).toFixed(2))
  expect(new Set(phases).size).toBe(delays.length)
})

test('reroll spins the new featured cards in', () => {
  render(<Shop />)
  expect(document.querySelectorAll('.spin-in')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: /reroll/i }))
  expect(document.querySelectorAll('.spin-in')).toHaveLength(3)
})

test('rerolling while every card is shown does not replay the spin', () => {
  render(<Shop />)
  fireEvent.click(screen.getByRole('button', { name: /see all cards/i }))
  fireEvent.click(screen.getByRole('button', { name: /reroll/i }))
  expect(document.querySelectorAll('.spin-in')).toHaveLength(0)
})
