import { editions } from './registry'
import type { EditionSettings } from './roll'

/** Rounded percentage per edition; no usable weight means 100% Common. */
export function editionPercents(weights: Record<string, number>): Record<string, number> {
  const w = editions.map((e) => {
    const v = weights[e.id]
    return Number.isFinite(v) && v > 0 ? v : 0
  })
  const total = w.reduce((a, b) => a + b, 0)
  return Object.fromEntries(
    editions.map((e, i) => [e.id, total > 0 ? Math.round((w[i] / total) * 100) : e.id === 'common' ? 100 : 0]),
  )
}

/** What guests should see: a forced edition is certain; otherwise the weighted odds. */
export function displayedOdds({ weights, forced }: EditionSettings): Record<string, number> {
  if (forced !== 'random' && editions.some((e) => e.id === forced)) {
    return Object.fromEntries(editions.map((e) => [e.id, e.id === forced ? 100 : 0]))
  }
  return editionPercents(weights)
}
