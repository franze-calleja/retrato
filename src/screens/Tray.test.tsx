import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../App'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { useTray, type TrayItem } from '../store/tray'
import { Tray } from './Tray'

const add = (over: Partial<Omit<TrayItem, 'id'>> = {}) =>
  useTray.getState().add({ templateId: 'ticket', name: 'Ticket', edition: 'foil', url: 'blob:t', size: { w: 144, h: 60 }, copies: 1, ...over })
const printImgs = () => [...document.querySelectorAll<HTMLImageElement>('.print-page img')]

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useBooth.setState(useBooth.getInitialState(), true)
  useTray.setState(useTray.getInitialState(), true)
  window.print = vi.fn()
})

test('lists entries with name, edition and copies', () => {
  add({ copies: 3 })
  render(<Tray />)
  expect(screen.getByText(/ticket — foil/i)).toBeTruthy()
  expect(screen.getByRole('group', { name: /copies of ticket/i }).textContent).toContain('3')
})

test('stepper changes copies and the page count follows', () => {
  add({ copies: 4 })
  render(<Tray />)
  expect(screen.getByTestId('page-count').textContent).toBe('1 page')
  fireEvent.click(screen.getByRole('button', { name: /more copies/i }))
  expect(useTray.getState().items[0].copies).toBe(5)
  expect(screen.getByTestId('page-count').textContent).toBe('2 pages')
  expect(screen.getByRole('button', { name: /print 2 pages/i })).toBeTruthy()
})

test('Remove drops an entry', () => {
  add()
  add({ name: 'Stamp', templateId: 'stamp', size: { w: 50, h: 62 } })
  render(<Tray />)
  fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
  expect(useTray.getState().items.map((i) => i.name)).toEqual(['Stamp'])
})

test('empty tray says so and cannot print', () => {
  render(<Tray />)
  expect(screen.getByText(/your tray is empty/i)).toBeTruthy()
  expect((screen.getByRole('button', { name: /^print/i }) as HTMLButtonElement).disabled).toBe(true)
})

test('Print waits for the sheet images, then prints', () => {
  add({ copies: 2 })
  render(<Tray />)
  fireEvent.click(screen.getByRole('button', { name: /print 1 page/i }))
  expect(window.print).not.toHaveBeenCalled()
  printImgs().forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('Print after the images loaded prints straight away', () => {
  add()
  render(<Tray />)
  printImgs().forEach((img) => fireEvent.load(img))
  fireEvent.click(screen.getByRole('button', { name: /print 1 page/i }))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('editing the tray while loading waits for the new layout', () => {
  add()
  render(<Tray />)
  fireEvent.click(screen.getByRole('button', { name: /print 1 page/i }))
  fireEvent.click(screen.getByRole('button', { name: /more copies/i }))
  const imgs = printImgs()
  expect(imgs).toHaveLength(2)
  fireEvent.load(imgs[0])
  expect(window.print).not.toHaveBeenCalled()
  fireEvent.load(imgs[1])
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('after printing, a banner offers to clear or keep the tray', () => {
  add()
  render(<Tray />)
  act(() => { window.dispatchEvent(new Event('afterprint')) })
  expect(screen.getByText(/done printing\?/i)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^keep$/i }))
  expect(screen.queryByText(/done printing\?/i)).toBeNull()
  expect(useTray.getState().items).toHaveLength(1)
  act(() => { window.dispatchEvent(new Event('afterprint')) })
  fireEvent.click(screen.getAllByRole('button', { name: /clear tray/i })[0])
  expect(useTray.getState().items).toHaveLength(0)
})

test('header button shows total copies, opens the tray, and Back returns to the same screen', () => {
  render(<App />)
  expect(screen.queryByRole('button', { name: /print tray/i })).toBeNull()
  act(() => { add({ copies: 3 }) })
  fireEvent.click(screen.getByRole('button', { name: /print tray \(3\)/i }))
  expect(screen.getByRole('heading', { name: /print tray/i })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /print tray \(/i })).toBeNull()
  expect(useBooth.getState().screen).toBe('picker')
  fireEvent.click(screen.getByRole('button', { name: /back/i }))
  expect(screen.queryByRole('heading', { name: /print tray/i })).toBeNull()
  expect(screen.getByRole('button', { name: /print tray \(3\)/i })).toBeTruthy()
})

test('a layout that comes back after an edit waits for its reloaded images', () => {
  add()
  render(<Tray />)
  printImgs().forEach((img) => fireEvent.load(img))
  fireEvent.click(screen.getByRole('button', { name: /more copies/i }))
  fireEvent.click(screen.getByRole('button', { name: /fewer copies/i }))
  fireEvent.click(screen.getByRole('button', { name: /print 1 page/i }))
  expect(window.print).not.toHaveBeenCalled()
  printImgs().forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('each Remove button names its card', () => {
  add()
  add({ name: 'Stamp', templateId: 'stamp', size: { w: 50, h: 62 } })
  render(<Tray />)
  expect(screen.getByRole('button', { name: 'Remove Ticket' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Remove Stamp' })).toBeTruthy()
})

test('the after-print question is announced in a live region', () => {
  add()
  render(<Tray />)
  const live = screen.getByTestId('tray-live')
  expect(live.getAttribute('role')).toBe('status')
  act(() => { window.dispatchEvent(new Event('afterprint')) })
  expect(live.textContent).toMatch(/done printing\?/i)
})

test('page preview labels use singular for one card', () => {
  add()
  render(<Tray />)
  expect(screen.getByRole('img', { name: 'Page 1: 1 card' })).toBeTruthy()
})

test('Ctrl/Cmd+P on the tray screen runs the tray print', () => {
  add()
  render(<Tray />)
  printImgs().forEach((img) => fireEvent.load(img))
  const ev = createEvent.keyDown(window, { key: 'p', metaKey: true })
  fireEvent(window, ev)
  expect(ev.defaultPrevented).toBe(true)
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('focus moves to the tray heading on open and back to the tray button on Back', () => {
  render(<App />)
  act(() => { add() })
  fireEvent.click(screen.getByRole('button', { name: /print tray \(1\)/i }))
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: /print tray/i }))
  fireEvent.click(screen.getByRole('button', { name: /back/i }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /print tray \(1\)/i }))
})
