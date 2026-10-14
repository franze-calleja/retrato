import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fitCount } from '../print/layout'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { TRAY_MAX, useTray } from '../store/tray'
import { resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'
import { Editor } from './Editor'

afterEach(() => useBooth.setState(useBooth.getInitialState(), true))

function open(revealed: boolean) {
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      screen: 'editor',
      templateId: 'ticket',
      edition: 'holo',
      values: resolveDefaults(getTemplate('ticket')),
      capture: { source: document.createElement('canvas'), w: 480, h: 512 },
      revealed,
    },
    true,
  )
  return render(<Editor />)
}

test('a card picked from a pack starts revealed', () => {
  const { container } = open(true)
  expect(container.querySelector('.reveal')?.getAttribute('data-phase')).toBe('shown')
})

test('a direct capture still plays the flip', () => {
  const { container } = open(false)
  expect(container.querySelector('.reveal')?.getAttribute('data-phase')).toBe('back')
})

beforeEach(() => {
  useTray.setState(useTray.getInitialState(), true)
  useOperator.getState().setPaper('a4')
  window.print = vi.fn()
})

const printImgs = () => [...document.querySelectorAll<HTMLImageElement>('.print-page img')]

test('Print lays out the chosen number of copies and prints once they load', () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  const imgs = printImgs()
  expect(imgs).toHaveLength(4)
  expect(imgs[0].style.width).toBe(`${getTemplate('ticket').printSizeMm.w}mm`)
  imgs.forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('Fill page prints as many copies as fit on one page', () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: 'fill' } })
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect(printImgs()).toHaveLength(fitCount(getTemplate('ticket').printSizeMm, 'a4'))
  expect(document.querySelectorAll('.print-page')).toHaveLength(1)
})

test('pressing Print twice prints once per press', () => {
  open(true)
  const print = screen.getByRole('button', { name: 'Print' })
  fireEvent.click(print)
  printImgs().forEach((img) => fireEvent.load(img))
  fireEvent.click(print)
  printImgs().forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(2)
})

test('Print does not touch the tray', () => {
  open(true)
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect(useTray.getState().items).toHaveLength(0)
})

test('Add to tray stores the card with its copies and confirms', async () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: /add to tray/i }))
  await waitFor(() => expect(useTray.getState().items).toHaveLength(1))
  expect(useTray.getState().items[0]).toMatchObject({
    templateId: 'ticket', name: getTemplate('ticket').name, edition: 'holo', copies: 2, size: getTemplate('ticket').printSizeMm,
  })
  expect(screen.getByRole('status').textContent).toMatch(/added to tray/i)
})

test('a full tray disables Add and says why', () => {
  for (let i = 0; i < TRAY_MAX; i++)
    useTray.getState().add({ templateId: 'stamp', name: 'Stamp', edition: 'common', url: `blob:${i}`, size: { w: 50, h: 62 }, copies: 1 })
  open(true)
  expect((screen.getByRole('button', { name: /tray full \(20\)/i }) as HTMLButtonElement).disabled).toBe(true)
})

test('a failed render adds nothing and says so', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { cb(null) })
  open(true)
  fireEvent.click(screen.getByRole('button', { name: /add to tray/i }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/couldn.t add this card/i))
  expect(useTray.getState().items).toHaveLength(0)
  vi.restoreAllMocks()
})
