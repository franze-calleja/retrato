import type { Template } from '../templates/types'

export type GlareVariant = 'common' | 'foil' | 'holo' | 'poly'
const VARIANTS: readonly GlareVariant[] = ['foil', 'holo', 'poly']

export const glareVariant = (editionId: string): GlareVariant => VARIANTS.find((v) => v === editionId) ?? 'common'

const pct = (v: number, of: number) => `${Number(((v / of) * 100).toFixed(3))}%`

/** Card rectangle minus the photo window (its bounding rect for shaped windows), as a responsive clip-path. */
export function glareClip(t: Template): string {
  const { x, y, w, h } = t.photoRect
  const x1 = pct(x, t.size.w)
  const y1 = pct(y, t.size.h)
  const x2 = pct(x + w, t.size.w)
  const y2 = pct(y + h, t.size.h)
  return `polygon(evenodd, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${x1} ${y1}, ${x2} ${y1}, ${x2} ${y2}, ${x1} ${y2}, ${x1} ${y1})`
}
