import { common } from './common'
import { foil } from './foil'
import { holo } from './holo'
import { poly } from './poly'
import type { Edition } from './types'

export const editions: readonly Edition[] = [common, foil, holo, poly]

export function getEdition(id: string | null | undefined): Edition {
  return editions.find((e) => e.id === id) ?? common
}

export const DEFAULT_WEIGHTS: Record<string, number> = Object.fromEntries(editions.map((e) => [e.id, e.defaultWeight]))
