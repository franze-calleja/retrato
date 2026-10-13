import { editions } from './registry'

export interface EditionSettings {
  weights: Record<string, number>
  /** 'random' or an edition id. */
  forced: string
}

export function rollEdition(settings: EditionSettings, rand: () => number = Math.random): string {
  if (settings.forced !== 'random' && editions.some((e) => e.id === settings.forced)) return settings.forced
  const weights = editions.map((e) => {
    const v = settings.weights[e.id]
    return Number.isFinite(v) && v > 0 ? v : 0
  })
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 'common'
  let r = rand() * total
  let last = 'common'
  for (let i = 0; i < editions.length; i++) {
    if (weights[i] <= 0) continue
    last = editions[i].id
    if (r < weights[i]) return last
    r -= weights[i]
  }
  return last // rand() === 1 or float drift
}
