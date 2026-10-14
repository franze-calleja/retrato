import { create } from 'zustand'
import { DEFAULT_WEIGHTS, editions } from '../editions/registry'
import type { EditionSettings } from '../editions/roll'
import type { PaperId } from '../print/layout'
import { readJson, writeJson } from './storage'

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

export function loadSettings(): EditionSettings {
  return sanitize(readJson(OPERATOR_KEY))
}

export const isPaper = (v: unknown): v is PaperId => v === 'a4' || v === 'letter'

export function loadPaper(): PaperId {
  const raw = readJson(OPERATOR_KEY) as { paper?: unknown } | null
  return raw && typeof raw === 'object' && isPaper(raw.paper) ? raw.paper : 'a4'
}

function save({ weights, forced, paper }: EditionSettings & { paper: PaperId }) {
  writeJson(OPERATOR_KEY, { weights, forced, paper })
}

interface OperatorState extends EditionSettings {
  paper: PaperId
  setWeight(id: string, weight: number): void
  setForced(forced: string): void
  setPaper(paper: string): void
  reset(): void
}

export const useOperator = create<OperatorState>()((set, get) => ({
  ...loadSettings(),
  paper: loadPaper(),
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
  setPaper(paper) {
    if (!isPaper(paper)) return
    set({ paper })
    save(get())
  },
  reset() {
    set({ ...defaultSettings(), paper: 'a4' })
    save(get())
  },
}))
