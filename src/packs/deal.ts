import { rollEdition, type EditionSettings } from '../editions/roll'
import { refreshPerCapture, resolveDefaults } from '../templates/fields'
import { templates } from '../templates/registry'

export interface PackCard {
  templateId: string
  edition: string
  values: Record<string, string>
}

export const PACK_SIZE = 3

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
  settings: EditionSettings,
  saved: Record<string, Record<string, string>>,
  rand: () => number = Math.random,
): PackCard[] {
  return pickDistinct(templates, PACK_SIZE, rand).map((t) => ({
    templateId: t.id,
    edition: rollEdition(settings, rand),
    values: refreshPerCapture(t, saved[t.id] ?? resolveDefaults(t)),
  }))
}
