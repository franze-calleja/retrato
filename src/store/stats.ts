import { create } from 'zustand'
import { migrateKey, readJson, writeJson } from './storage'

export const STATS_KEY = 'retrato:stats'
/** Where the count was saved before the app was renamed. */
const LEGACY_STATS_KEY = 'pixel-booth:stats'

export function loadPhotos(): number {
  migrateKey(LEGACY_STATS_KEY, STATS_KEY)
  const n = (readJson(STATS_KEY) as { photos?: unknown } | null)?.photos
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0
}

interface StatsState {
  /** Photos taken on this device since the operator last reset the counter. */
  photos: number
  recordPhoto(): void
  resetPhotos(): void
}

export const useStats = create<StatsState>()((set, get) => ({
  photos: loadPhotos(),
  recordPhoto() {
    set({ photos: get().photos + 1 })
    writeJson(STATS_KEY, { photos: get().photos })
  },
  resetPhotos() {
    set({ photos: 0 })
    writeJson(STATS_KEY, { photos: 0 })
  },
}))
