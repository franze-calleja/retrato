import { create } from 'zustand'
import { DEFAULT_WEIGHTS, editions } from '../editions/registry'
import type { EditionSettings } from '../editions/roll'
import type { PaperId } from '../print/layout'
import { useSound } from './sound'
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

export const DEFAULT_MUSIC = 40
export const DEFAULT_SFX = 70
const isVolume = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100
const clampVolume = (v: number) => Math.round(Math.min(100, Math.max(0, v)))
const savedField = (key: string): unknown => {
  const raw = readSaved()
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined
}

export function loadMusicVolume(): number {
  const v = savedField('musicVolume')
  return isVolume(v) ? v : DEFAULT_MUSIC
}

export function loadSfxVolume(): number {
  const v = savedField('sfxVolume')
  return isVolume(v) ? v : DEFAULT_SFX
}

export function loadShowSoundButton(): boolean {
  const v = savedField('showSoundButton')
  return typeof v === 'boolean' ? v : true
}

type Saved = EditionSettings & { paper: PaperId; idleMinutes: number; musicVolume: number; sfxVolume: number; showSoundButton: boolean }
function save({ weights, forced, paper, idleMinutes, musicVolume, sfxVolume, showSoundButton }: Saved) {
  writeJson(OPERATOR_KEY, { weights, forced, paper, idleMinutes, musicVolume, sfxVolume, showSoundButton })
}

interface OperatorState extends EditionSettings {
  paper: PaperId
  idleMinutes: number
  musicVolume: number
  sfxVolume: number
  showSoundButton: boolean
  setWeight(id: string, weight: number): void
  setForced(forced: string): void
  setPaper(paper: string): void
  setIdleMinutes(minutes: number): void
  setMusicVolume(v: number): void
  setSfxVolume(v: number): void
  setShowSoundButton(show: boolean): void
  reset(): void
}

export const useOperator = create<OperatorState>()((set, get) => ({
  ...loadSettings(),
  paper: loadPaper(),
  idleMinutes: loadIdleMinutes(),
  musicVolume: loadMusicVolume(),
  sfxVolume: loadSfxVolume(),
  showSoundButton: loadShowSoundButton(),
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
  setMusicVolume(v) {
    if (!Number.isFinite(v)) return
    set({ musicVolume: clampVolume(v) })
    save(get())
  },
  setSfxVolume(v) {
    if (!Number.isFinite(v)) return
    set({ sfxVolume: clampVolume(v) })
    save(get())
  },
  setShowSoundButton(show) {
    // With no button a guest's mute couldn't be undone: hiding it hands control back to these volumes.
    if (!show) useSound.getState().resetToDefault()
    set({ showSoundButton: show })
    save(get())
  },
  reset() {
    set({ ...defaultSettings(), paper: 'a4', idleMinutes: DEFAULT_IDLE, musicVolume: DEFAULT_MUSIC, sfxVolume: DEFAULT_SFX, showSoundButton: true })
    save(get())
  },
}))
