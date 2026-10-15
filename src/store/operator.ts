import { create } from 'zustand'
import { DEFAULT_WEIGHTS, editions } from '../editions/registry'
import type { EditionSettings } from '../editions/roll'
import type { PaperId } from '../print/layout'
import { migrateKey, readJson, writeJson } from './storage'

export const OPERATOR_KEY = 'retrato:operator'
/** Where settings were saved before the app was renamed. */
const LEGACY_OPERATOR_KEY = 'pixel-booth:operator'

function readSaved(): unknown {
  migrateKey(LEGACY_OPERATOR_KEY, OPERATOR_KEY)
  return readJson(OPERATOR_KEY)
}

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
  return sanitize(readSaved())
}

export const isPaper = (v: unknown): v is PaperId => v === 'a4' || v === 'letter'

export function loadPaper(): PaperId {
  const raw = readSaved() as { paper?: unknown } | null
  return raw && typeof raw === 'object' && isPaper(raw.paper) ? raw.paper : 'a4'
}

/** Minutes without input before the booth resets for the next guest; 0 = off. */
export const IDLE_CHOICES = [0, 1, 3, 5, 10] as const
export const DEFAULT_IDLE = 3
const isIdle = (v: unknown): v is number => IDLE_CHOICES.some((c) => c === v)

export function loadIdleMinutes(): number {
  const raw = readSaved() as { idleMinutes?: unknown } | null
  return raw && typeof raw === 'object' && isIdle(raw.idleMinutes) ? raw.idleMinutes : DEFAULT_IDLE
}

function save({ weights, forced, paper, idleMinutes }: EditionSettings & { paper: PaperId; idleMinutes: number }) {
  writeJson(OPERATOR_KEY, { weights, forced, paper, idleMinutes })
}

interface OperatorState extends EditionSettings {
  paper: PaperId
  idleMinutes: number
  setWeight(id: string, weight: number): void
  setForced(forced: string): void
  setPaper(paper: string): void
  setIdleMinutes(minutes: number): void
  reset(): void
}

export const useOperator = create<OperatorState>()((set, get) => ({
  ...loadSettings(),
  paper: loadPaper(),
  idleMinutes: loadIdleMinutes(),
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
  setIdleMinutes(minutes) {
    if (!isIdle(minutes)) return
    set({ idleMinutes: minutes })
    save(get())
  },
  reset() {
    set({ ...defaultSettings(), paper: 'a4', idleMinutes: DEFAULT_IDLE })
    save(get())
  },
}))
