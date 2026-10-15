import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import * as sfx from './sfx'
import { isTappable, useTapSounds } from './useTapSounds'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setup() {
  const play = vi.spyOn(sfx, 'play').mockReturnValue(null)
  renderHook(() => useTapSounds())
  render(
    <div>
      <button>Plain <span>inner</span></button>
      <button data-sfx>Own sound</button>
      <button disabled>Disabled</button>
      <select aria-label="Pick"><option>1</option></select>
      <button className="tile-btn">Tile</button>
      <p>Text</p>
    </div>,
  )
  return play
}

test('tapping a button or select ticks, even on its inner text', () => {
  const play = setup()
  fireEvent.pointerDown(screen.getByText('inner'))
  fireEvent.pointerDown(screen.getByLabelText('Pick'))
  expect(play.mock.calls).toEqual([['tick'], ['tick']])
})

test('buttons with their own sound, disabled buttons and plain text stay quiet', () => {
  const play = setup()
  fireEvent.pointerDown(screen.getByText('Own sound'))
  fireEvent.pointerDown(screen.getByText('Disabled'))
  fireEvent.pointerDown(screen.getByText('Text'))
  expect(play).not.toHaveBeenCalled()
})

test('hovering a card tile with a mouse plays a soft hover', () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: fine)' }))
  const play = setup()
  fireEvent.pointerOver(screen.getByText('Tile'), { relatedTarget: document.body })
  expect(play).toHaveBeenCalledWith('hover')
})

test('isTappable ignores non-elements', () => {
  expect(isTappable(null)).toBe(false)
  expect(isTappable(window)).toBe(false)
})
