import { expect, test } from 'vitest'
import { GLINT_CYCLE, glintDelay } from './glint'

const phase = (delay: number, mountedAt: number) => (((mountedAt / 1000 + -delay) % GLINT_CYCLE) + GLINT_CYCLE) % GLINT_CYCLE

test('items are spread evenly across one cycle, so no two shine together', () => {
  const total = 11
  const starts = Array.from({ length: total }, (_, i) => (i * GLINT_CYCLE) / total)
  const delays = starts.map((_, i) => glintDelay(i, total, 0))
  const phases = delays.map((d) => phase(d, 0)).sort((a, b) => a - b)
  for (let i = 1; i < phases.length; i++) expect(phases[i] - phases[i - 1]).toBeCloseTo(GLINT_CYCLE / total, 2)
})

test('an item mounted later keeps the shared rhythm', () => {
  // Item 2 of 7 mounted at t=0 and again (after a reroll) at t=12.3 s are in the same place on the shared clock.
  const now = 12_300
  const fresh = glintDelay(2, 7, now)
  const atNow = (-fresh) % GLINT_CYCLE // seconds into its cycle at mount time
  const expected = ((now / 1000 - (2 * GLINT_CYCLE) / 7) % GLINT_CYCLE + GLINT_CYCLE) % GLINT_CYCLE
  expect(((atNow % GLINT_CYCLE) + GLINT_CYCLE) % GLINT_CYCLE).toBeCloseTo(expected, 2)
})
