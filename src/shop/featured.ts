import { pickDistinct } from '../packs/deal'

export const FEATURED_COUNT = 3
const MAX_TRIES = 12

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join()

/** A fresh featured set; differs from `current` whenever there are enough ids to allow it. */
export function nextFeatured(ids: readonly string[], current: readonly string[], rand: () => number): string[] {
  let next = pickDistinct(ids, FEATURED_COUNT, rand)
  for (let i = 0; i < MAX_TRIES && ids.length > FEATURED_COUNT && sameSet(next, current); i++) {
    next = pickDistinct(ids, FEATURED_COUNT, rand)
  }
  return next
}
