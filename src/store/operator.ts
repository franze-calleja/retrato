import { create } from 'zustand'
import { DEFAULT_WEIGHTS, editions } from '../editions/registry'
import type { EditionSettings } from '../editions/roll'

export const OPERATOR_KEY = 'pixel-booth:operator'

const isEdition = (id: unknown): id is string => editions.some((e) => e.id === id)
const clampWeight = (v: number) => Math.min(100, Math.max(0, v))

export const defaultSettings = (): EditionSettings => ({ weights: { ...DEFAULT_WEIGHTS }, forced: 'random' })

export function sanitize(raw: unknown): EditionSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as { weights?: unknown; forced?: unknown }
  const stored = (src.weights && typeof src.weights === 'object' ? src.weights : {}) as Record<string, unknown>
  const weights = Object.fromEntries(
    editions.map((e) => {
      const v = stored[e.id]
      return [e.id, typeof v === 'number' && Number.isFinite(v) ? clampWeight(v) : DEFAULT_WEIGHTS[e.id]]
    }),
  )
  const forced = src.forced === 'random' || isEdition(src.forced) ? (src.forced as string) : 'random'
  return { weights, forced }
}

// localStorage can be missing or throw (private mode, sandboxed iframes, quota); settings then live in memory.
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadSettings(): EditionSettings {
  try {
    const raw = storage()?.getItem(OPERATOR_KEY)
    return sanitize(raw ? JSON.parse(raw) : null)
  } catch {
    return defaultSettings()
  }
}

function save({ weights, forced }: EditionSettings) {
  try {
    storage()?.setItem(OPERATOR_KEY, JSON.stringify({ weights, forced }))
  } catch {
    // Keep working in memory.
  }
}

interface OperatorState extends EditionSettings {
  setWeight(id: string, weight: number): void
  setForced(forced: string): void
  reset(): void
}

export const useOperator = create<OperatorState>()((set, get) => ({
  ...loadSettings(),
  setWeight(id, weight) {
    if (!isEdition(id) || !Number.isFinite(weight)) return
    set({ weights: { ...get().weights, [id]: clampWeight(weight) } })
    save(get())
  },
  setForced(forced) {
    if (forced !== 'random' && !isEdition(forced)) return
    set({ forced })
    save(get())
  },
  reset() {
    set(defaultSettings())
    save(get())
  },
}))
