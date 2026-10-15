import { create } from 'zustand'
import type { Levels } from '../audio/engine'
import { readJson, writeJson } from './storage'

export type SoundMode = 'all' | 'sfx' | 'off'
export const SOUND_KEY = 'retrato:sound'
const MODES: readonly SoundMode[] = ['all', 'sfx', 'off']
const isMode = (v: unknown): v is SoundMode => MODES.includes(v as SoundMode)

export function loadMode(): SoundMode {
  const raw = readJson(SOUND_KEY) as { mode?: unknown } | null
  return raw && typeof raw === 'object' && isMode(raw.mode) ? raw.mode : 'all'
}

/** What actually plays: the guest's mode applied to the operator's volumes (0–100). */
export function effectiveLevels(mode: SoundMode, musicVolume: number, sfxVolume: number): Levels {
  return { music: mode === 'all' ? musicVolume / 100 : 0, sfx: mode === 'off' ? 0 : sfxVolume / 100 }
}

interface SoundState {
  /** The guest's choice from the speaker button: all on, effects only, or off. */
  mode: SoundMode
  cycle(): void
  resetToDefault(): void
}

export const useSound = create<SoundState>()((set, get) => ({
  mode: loadMode(),
  cycle() {
    const mode = MODES[(MODES.indexOf(get().mode) + 1) % MODES.length]
    set({ mode })
    writeJson(SOUND_KEY, { mode })
  },
  resetToDefault() {
    set({ mode: 'all' })
    writeJson(SOUND_KEY, { mode: 'all' })
  },
}))
