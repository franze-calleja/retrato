import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { __setEngineForTest } from '../audio/engine'
import { FakeAudioContext, asAudio } from '../audio/fakeAudio'
import { useOperator } from '../store/operator'
import { useSound } from '../store/sound'
import { SoundButton } from './SoundButton'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useSound.getState().resetToDefault()
  __setEngineForTest(asAudio(new FakeAudioContext()))
})
afterEach(() => __setEngineForTest(undefined))

const button = () => screen.getByRole('button', { name: /^sound:/i })

test('clicking cycles all on → effects only → off, with matching labels', () => {
  render(<SoundButton keysOff={false} />)
  expect(button().getAttribute('aria-label')).toBe('Sound: all on')
  fireEvent.click(button())
  expect(button().getAttribute('aria-label')).toBe('Sound: effects only')
  fireEvent.click(button())
  expect(button().getAttribute('aria-label')).toBe('Sound: off')
})

test('M cycles too, but not while typing, with modifiers, or with keys off', () => {
  const { rerender } = render(
    <>
      <SoundButton keysOff={false} />
      <input aria-label="Name" />
    </>,
  )
  fireEvent.keyDown(window, { key: 'm' })
  expect(useSound.getState().mode).toBe('sfx')
  fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'm' })
  fireEvent.keyDown(window, { key: 'm', ctrlKey: true })
  fireEvent.keyDown(window, { key: 'M', metaKey: true })
  expect(useSound.getState().mode).toBe('sfx')
  rerender(<SoundButton keysOff={true} />)
  fireEvent.keyDown(window, { key: 'm' })
  expect(useSound.getState().mode).toBe('sfx')
})

test('hidden when the operator turns it off or there is no Web Audio', () => {
  useOperator.getState().setShowSoundButton(false)
  const { rerender } = render(<SoundButton keysOff={false} />)
  expect(screen.queryByRole('button')).toBeNull()
  useOperator.getState().setShowSoundButton(true)
  __setEngineForTest(null)
  rerender(<SoundButton keysOff={false} />)
  expect(screen.queryByRole('button')).toBeNull()
})
