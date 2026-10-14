import { render } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getEdition } from '../editions/registry'
import { getTemplate } from '../templates/registry'
import { resolveDefaults } from '../templates/fields'

const compose = vi.hoisted(() => vi.fn())
vi.mock('../render/composeStamp', () => ({ composeStamp: compose }))
const { ShimmerCard } = await import('./ShimmerCard')

let frames: FrameRequestCallback[] = []
let now = 0
const runFrame = (ms: number) => {
  now = ms
  const fs = frames
  frames = []
  fs.forEach((f) => f(ms))
}

beforeEach(() => {
  frames = []
  now = 0
  compose.mockClear()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => (frames.push(cb), frames.length))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})
afterEach(() => vi.restoreAllMocks())

const t = getTemplate('stamp')
const props = (values: Record<string, string>) => ({
  template: t,
  photo: { source: document.createElement('canvas'), w: 10, h: 10 },
  values,
  edition: getEdition('holo'),
  scale: 4,
  label: 'card',
  live: true,
})
const angles = () => compose.mock.calls.map((c) => c[5].angle as number)

test('frames that land on the same shimmer step are not redrawn', () => {
  render(<ShimmerCard {...props(resolveDefaults(t))} />)
  runFrame(0)
  runFrame(12)
  runFrame(24) // drift starts at step 22.4 of 64; the next step begins after ~31 ms
  expect(compose).toHaveBeenCalledTimes(1)
})

test('typing does not restart the idle drift', () => {
  const p = props(resolveDefaults(t))
  const { rerender } = render(<ShimmerCard {...p} />)
  runFrame(0)
  runFrame(10_000)
  const before = angles().at(-1)!
  rerender(<ShimmerCard {...p} values={{ ...p.values, title: 'HELLO' }} />)
  runFrame(10_016)
  const after = angles().at(-1)!
  expect(Math.abs(after - before)).toBeLessThan(0.01)
  expect(compose.mock.calls.at(-1)![2].title).toBe('HELLO')
})
