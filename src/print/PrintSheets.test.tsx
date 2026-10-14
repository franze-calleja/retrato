import { fireEvent, render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { packSheets, type SheetItem } from './layout'
import { PrintSheets } from './PrintSheets'

const items = (n: number, w = 144, h = 60): SheetItem[] => Array.from({ length: n }, (_, i) => ({ src: `blob:${i}`, w, h }))
const imgs = () => [...document.querySelectorAll<HTMLImageElement>('.print-page img')]

test('renders one page box per page, sized to the printable area', () => {
  render(<PrintSheets pages={packSheets(items(5), 'a4')} paper="a4" />)
  const pages = document.querySelectorAll<HTMLElement>('.print-page')
  expect(pages).toHaveLength(2)
  expect(pages[0].style.width).toBe('190mm')
  expect(pages[0].style.height).toBe('277mm')
})

test('cards are placed at real size in mm, with 8 cut marks each', () => {
  render(<PrintSheets pages={packSheets(items(2, 50, 62), 'a4')} paper="a4" />)
  const [a, b] = imgs()
  expect([a.style.left, a.style.top, a.style.width, a.style.height]).toEqual(['0mm', '0mm', '50mm', '62mm'])
  expect(b.style.left).toBe('54mm')
  expect(document.querySelectorAll('.cut-mark')).toHaveLength(16)
})

test('sets the @page size for the chosen paper', () => {
  render(<PrintSheets pages={packSheets(items(1), 'letter')} paper="letter" />)
  expect(document.querySelector('.print-sheets style')?.textContent).toMatch(/size:\s*letter/)
})

test('onReady fires once, after every image has loaded or failed', () => {
  const onReady = vi.fn()
  render(<PrintSheets pages={packSheets(items(3), 'a4')} paper="a4" onReady={onReady} />)
  const [a, b, c] = imgs()
  fireEvent.load(a)
  fireEvent.error(b)
  expect(onReady).not.toHaveBeenCalled()
  fireEvent.load(c)
  expect(onReady).toHaveBeenCalledTimes(1)
})

test('onReady fires immediately with no cards', () => {
  const onReady = vi.fn()
  render(<PrintSheets pages={[]} paper="a4" onReady={onReady} />)
  expect(onReady).toHaveBeenCalledTimes(1)
})

test('a remount with a new key waits for the new images only', () => {
  const onReady = vi.fn()
  const { rerender } = render(<PrintSheets key="1" pages={packSheets(items(2), 'a4')} paper="a4" onReady={onReady} />)
  fireEvent.load(imgs()[0])
  rerender(<PrintSheets key="2" pages={packSheets(items(3), 'a4')} paper="a4" onReady={onReady} />)
  const fresh = imgs()
  expect(fresh).toHaveLength(3)
  fireEvent.load(fresh[0])
  fireEvent.load(fresh[1])
  expect(onReady).not.toHaveBeenCalled()
  fireEvent.load(fresh[2])
  expect(onReady).toHaveBeenCalledTimes(1)
})
