import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useBooth } from '../store/booth'
import { Booth } from './Booth'

test('upload control stays in the tab order (camera fallback must be keyboard reachable)', () => {
  render(<Booth />)
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  expect(input.type).toBe('file')
  expect(input.hidden).toBe(false)
  expect(input.tabIndex).toBeGreaterThanOrEqual(0)
})

test('pack mode shows the viewfinder for the chosen pack', () => {
  useBooth.setState({ ...useBooth.getInitialState(), mode: 'pack', packId: 'arcana', screen: 'booth' }, true)
  render(<Booth />)
  expect(screen.getByRole('heading', { name: 'Arcana Pack' })).toBeTruthy()
  expect(screen.getByRole('img', { name: /arcana pack live preview/i })).toBeTruthy()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('an upload that finishes after leaving the booth does not open the editor', async () => {
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth' }, true)
  let resolve!: (b: ImageBitmap) => void
  const close = vi.fn()
  vi.stubGlobal('createImageBitmap', () => new Promise<ImageBitmap>((r) => (resolve = r)))
  const { unmount } = render(<Booth />)
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
  unmount()
  useBooth.getState().goToPicker()
  await act(async () => resolve({ width: 10, height: 10, close } as unknown as ImageBitmap))
  expect(useBooth.getState().screen).toBe('picker')
  expect(useBooth.getState().capture).toBeNull()
  expect(close).toHaveBeenCalled()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})
