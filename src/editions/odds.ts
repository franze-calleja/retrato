import { editions } from './registry'

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
