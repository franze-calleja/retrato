import { rollEdition, type EditionSettings } from '../editions/roll'
import { refreshPerCapture, resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'
import type { PackDef } from './catalog'

export interface PackCard {
  templateId: string
  edition: string
  values: Record<string, string>
}

export const PACK_SIZE = 3
const MAX_REROLLS = 25

/** Fisher–Yates shuffle, then take n (never more than there are items). */
export function pickDistinct<T>(items: readonly T[], n: number, rand: () => number): T[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(n, pool.length))
}

export function dealPack(
  pack: PackDef,
  settings: EditionSettings,
  saved: Record<string, Record<string, string>>,
  rand: () => number = Math.random,
): PackCard[] {
  const pool = pack.pool.map(getTemplate)
  // Enough card types: three different ones. Otherwise repeat the types but re-roll until each card differs.
  const picks = pool.length >= PACK_SIZE ? pickDistinct(pool, PACK_SIZE, rand) : Array.from({ length: PACK_SIZE }, (_, i) => pool[i % pool.length])
  const seen = new Set<string>()
  return picks.map((t) => {
    const base = saved[t.id] ?? resolveDefaults(t)
    let values = refreshPerCapture(t, base)
    for (let i = 0; i < MAX_REROLLS && seen.has(`${t.id}:${JSON.stringify(values)}`); i++) {
      values = refreshPerCapture(t, base)
    }
    seen.add(`${t.id}:${JSON.stringify(values)}`)
    return { templateId: t.id, edition: rollEdition(settings, rand), values }
  })
}
