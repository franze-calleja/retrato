import { create } from 'zustand'
import { rollEdition } from '../editions/roll'
import { getPack } from '../packs/catalog'
import { dealPack, type PackCard } from '../packs/deal'
import type { PhotoSource } from '../photo/crop'
import { clampValue, refreshPerCapture, resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'
import { useOperator } from './operator'
import { useStats } from './stats'

export type Screen = 'picker' | 'booth' | 'pack' | 'editor'
export type Mode = 'single' | 'pack'

interface BoothState {
  screen: Screen
  mode: Mode
  templateId: string
  capture: PhotoSource | null
  /** Edition id rolled for the current capture. */
  edition: string
  values: Record<string, string>
  /** Text remembered per card type, used by direct picks and pack deals. */
  saved: Record<string, Record<string, string>>
  pack: PackCard[] | null
  /** Which pack type is open in pack mode. */
  packId: string
  /** The card was already revealed (pack pick), so the editor skips its flip. */
  revealed: boolean
  selectTemplate(id: string): void
  selectPack(packId?: string): void
  setCapture(photo: PhotoSource): void
  pickPackCard(index: number): void
  retake(): void
  goToPicker(): void
  setValue(key: string, value: string): void
}

const cleared = { capture: null, edition: 'common', pack: null, revealed: false } as const

export const useBooth = create<BoothState>()((set, get) => ({
  screen: 'picker',
  mode: 'single',
  templateId: 'stamp',
  capture: null,
  edition: 'common',
  values: resolveDefaults(getTemplate('stamp')),
  saved: {},
  pack: null,
  packId: 'classic',
  revealed: false,

  selectTemplate(id) {
    set({
      ...cleared,
      mode: 'single',
      templateId: id,
      values: get().saved[id] ?? resolveDefaults(getTemplate(id)),
      screen: 'booth',
    })
  },
  selectPack: (packId = 'classic') => set({ ...cleared, mode: 'pack', packId: getPack(packId).id, screen: 'booth' }),
  setCapture(photo) {
    useStats.getState().recordPhoto()
    if (get().mode === 'pack') {
      set({ capture: photo, pack: dealPack(getPack(get().packId), useOperator.getState(), get().saved), screen: 'pack' })
      return
    }
    const t = getTemplate(get().templateId)
    set({
      capture: photo,
      edition: rollEdition(useOperator.getState()),
      values: refreshPerCapture(t, get().values),
      screen: 'editor',
    })
  },
  pickPackCard(index) {
    const card = get().pack?.[index]
    if (!card) return
    set({
      templateId: card.templateId,
      values: card.values,
      edition: card.edition,
      saved: { ...get().saved, [card.templateId]: card.values },
      revealed: true,
      screen: 'editor',
    })
  },
  retake: () => set({ ...cleared, screen: 'booth' }),
  goToPicker: () => set({ ...cleared, screen: 'picker' }),
  setValue(key, value) {
    const { templateId, values, saved } = get()
    const field = getTemplate(templateId).fields.find((f) => f.key === key)
    if (!field) return
    const next = { ...values, [key]: clampValue(field, value) }
    set({ values: next, saved: { ...saved, [templateId]: next } })
  },
}))
