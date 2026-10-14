/** Seconds for one full round of shelf shines. */
export const GLINT_CYCLE = 7

/**
 * CSS animation-delay (seconds) for shelf item `slot` of `total`: items are spaced evenly over one cycle so no two
 * shine together, and the delay is measured against a shared clock (`nowMs` = mount time) so an item that remounts
 * (after a reroll) keeps the shelf's rhythm instead of restarting it.
 */
export function glintDelay(slot: number, total: number, nowMs: number): number {
  const start = (slot * GLINT_CYCLE) / Math.max(1, total)
  return Number((start - ((nowMs / 1000) % GLINT_CYCLE)).toFixed(3))
}
