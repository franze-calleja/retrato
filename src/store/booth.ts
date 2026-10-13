import { create } from 'zustand'
import type { PhotoSource } from '../photo/crop'
import { clampValue, refreshPerCapture, resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'

export type Screen = 'picker' | 'booth' | 'editor'

interface BoothState {
  screen: Screen
  templateId: string
  capture: PhotoSource | null
  values: Record<string, string>
  selectTemplate(id: string): void
  setCapture(photo: PhotoSource): void
  retake(): void
  goToPicker(): void
  setValue(key: string, value: string): void
}

export const useBooth = create<BoothState>()((set, get) => ({
  screen: 'picker',
  templateId: 'stamp',
  capture: null,
  values: resolveDefaults(getTemplate('stamp')),

  selectTemplate(id) {
    const same = id === get().templateId
    set({
      templateId: id,
      values: same ? get().values : resolveDefaults(getTemplate(id)),
      capture: null,
      screen: 'booth',
    })
  },
  setCapture(photo) {
    const t = getTemplate(get().templateId)
    set({ capture: photo, values: refreshPerCapture(t, get().values), screen: 'editor' })
  },
  retake: () => set({ capture: null, screen: 'booth' }),
  goToPicker: () => set({ capture: null, screen: 'picker' }),
  setValue(key, value) {
    const field = getTemplate(get().templateId).fields.find((f) => f.key === key)
    if (!field) return
    set({ values: { ...get().values, [key]: clampValue(field, value) } })
  },
}))
