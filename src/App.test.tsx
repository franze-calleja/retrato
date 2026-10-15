import { act, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'
import { useOperator } from './store/operator'
import { useSound } from './store/sound'

afterEach(() => vi.useRealTimers())

test('the idle reset turns sound back on for the next guest', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useOperator.getState().reset()
  render(<App />)
  act(() => useSound.setState({ mode: 'off' }))
  act(() => { vi.advanceTimersByTime(3 * 60_000) })
  expect(useSound.getState().mode).toBe('all')
})
