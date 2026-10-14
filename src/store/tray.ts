import { create } from 'zustand'
import type { SheetItem } from '../print/layout'

// Memory only by design: guest photos are never written to storage.

export const TRAY_MAX = 20
export const MAX_COPIES = 20

export interface TrayItem {
  id: string
  templateId: string
  name: string
  /** Edition id. */
  edition: string
  /** Object URL of the frozen card PNG. */
  url: string
  /** Print size in mm. */
  size: { w: number; h: number }
  copies: number
}

export const clampCopies = (n: number) => (Number.isFinite(n) ? Math.min(MAX_COPIES, Math.max(1, Math.round(n))) : 1)

export const trayCopies = (items: TrayItem[]) => items.reduce((n, i) => n + i.copies, 0)

export const traySheetItems = (items: TrayItem[]): SheetItem[] =>
  items.flatMap((i) => Array.from({ length: i.copies }, () => ({ src: i.url, w: i.size.w, h: i.size.h })))

interface TrayState {
  items: TrayItem[]
  /** The tray screen is showing. */
  open: boolean
  add(item: Omit<TrayItem, 'id'>): boolean
  setCopies(id: string, n: number): void
  remove(id: string): void
  clear(): void
  show(): void
  hide(): void
}

let nextId = 0

export const useTray = create<TrayState>()((set, get) => ({
  items: [],
  open: false,
  add(item) {
    if (get().items.length >= TRAY_MAX) return false
    set({ items: [...get().items, { ...item, id: `tray-${++nextId}`, copies: clampCopies(item.copies) }] })
    return true
  },
  setCopies(id, n) {
    set({ items: get().items.map((i) => (i.id === id ? { ...i, copies: clampCopies(n) } : i)) })
  },
  remove(id) {
    const gone = get().items.find((i) => i.id === id)
    if (!gone) return
    URL.revokeObjectURL(gone.url)
    set({ items: get().items.filter((i) => i.id !== id) })
  },
  clear() {
    for (const i of get().items) URL.revokeObjectURL(i.url)
    set({ items: [], open: false })
  },
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
