import { CREAM, GOLD, OUTLINE, PURPLE, PURPLE_DARK, SHADOW } from './colors'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawText, drawTextCentered, drawTextRight, fitScale } from './pixelFont'
import type { Template } from './types'

const BW = 96
const BH = 134
const SHADOW_OFFSET = 3
const PHOTO = { x: 10, y: 22, w: 76, h: 64 }
const STATS = [
  { key: 'charm', label: 'CHARM' },
  { key: 'chaos', label: 'CHAOS' },
  { key: 'luck', label: 'LUCK' },
] as const
const PIPS = 9

export function rollStat(rand: () => number = Math.random): string {
  return String(1 + Math.floor(rand() * PIPS))
}

/** Pip count for a stat field; anything that isn't a number shows no pips. */
export function statValue(v: string): number {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(PIPS, Math.max(0, n)) : 0
}

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, PURPLE, 1, 1, BW - 2, BH - 2, 2)

  // Gold name banner.
  panel(ctx, OUTLINE, 4, 4, BW - 8, 13, 2)
  panel(ctx, GOLD, 5, 5, BW - 10, 11, 1)
  const name = values.name ?? ''
  const ns = fitScale(name, 80, 2)
  drawTextCentered(ctx, name, BW / 2, ns === 2 ? 6 : 8, OUTLINE, ns)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  drawTextCentered(ctx, values.type ?? '', BW / 2, 92, CREAM, 1, PURPLE_DARK)

  // Stats box: label, 9 pips, number.
  panel(ctx, OUTLINE, 6, 100, BW - 12, 29, 2)
  panel(ctx, PURPLE_DARK, 7, 101, BW - 14, 27, 1)
  STATS.forEach(({ key, label }, row) => {
    const y = 104 + row * 8
    const raw = values[key] ?? ''
    const n = statValue(raw)
    drawText(ctx, label, 10, y, CREAM)
    for (let i = 0; i < PIPS; i++) fill(ctx, i < n ? GOLD : OUTLINE, 36 + i * 4, y, 3, 5)
    drawTextRight(ctx, raw, 86, y, GOLD)
  })
}

export const trading: Template = {
  id: 'trading',
  name: 'Trading Card',
  description: 'Collectible card · rolls CHARM, CHAOS & LUCK',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  badgeAt: { x: 0, y: BH - 9 }, // over the stats box's bottom-left corner, clear of the name banner
  printSizeMm: { w: 63, h: Math.round(((63 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'name', label: 'Name', default: 'PLAYER ONE', maxLength: 12 },
    { key: 'type', label: 'Type', default: 'PIXEL LEGEND', maxLength: 16 },
    ...STATS.map(({ key, label }) => ({
      key,
      label: label[0] + label.slice(1).toLowerCase(),
      default: () => rollStat(),
      maxLength: 1,
      perCapture: true,
    })),
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
