import { create } from 'zustand'
import { rollEdition } from '../editions/roll'
import type { PhotoSource } from '../photo/crop'
import { clampValue, refreshPerCapture, resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'
import { useOperator } from './operator'

export type Screen = 'picker' | 'booth' | 'editor'

interface BoothState {
  screen: Screen
  templateId: string
  capture: PhotoSource | null
  /** Edition id rolled for the current capture. */
  edition: string
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
  edition: 'common',
  values: resolveDefaults(getTemplate('stamp')),

  selectTemplate(id) {
    const same = id === get().templateId
    set({
      templateId: id,
      values: same ? get().values : resolveDefaults(getTemplate(id)),
      capture: null,
      edition: 'common',
      screen: 'booth',
    })
  },
  setCapture(photo) {
    const t = getTemplate(get().templateId)
    set({
      capture: photo,
      edition: rollEdition(useOperator.getState()),
      values: refreshPerCapture(t, get().values),
      screen: 'editor',
    })
  },
  retake: () => set({ capture: null, edition: 'common', screen: 'booth' }),
  goToPicker: () => set({ capture: null, edition: 'common', screen: 'picker' }),
  setValue(key, value) {
    const field = getTemplate(get().templateId).fields.find((f) => f.key === key)
    if (!field) return
    set({ values: { ...get().values, [key]: clampValue(field, value) } })
  },
}))
