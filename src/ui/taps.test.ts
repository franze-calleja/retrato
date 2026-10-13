import { expect, test } from 'vitest'
import { registerTap } from './taps'

test('triggers on the 5th tap inside the window and resets', () => {
  let times: number[] = []
  for (const now of [0, 300, 600, 900]) {
    const r = registerTap(times, now)
    expect(r.triggered).toBe(false)
    times = r.times
  }
  const r = registerTap(times, 1200)
  expect(r).toEqual({ times: [], triggered: true })
})

test('taps older than the window do not count', () => {
  let times: number[] = []
  for (const now of [0, 500, 1000, 1500]) times = registerTap(times, now).times
  expect(registerTap(times, 2600).triggered).toBe(false)
})
