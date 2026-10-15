import { CREAM, GOLD, GOLD_DARK, GOLD_LIGHT, OUTLINE, PURPLE, PURPLE_DARK, PURPLE_LIGHT, SHADOW } from './colors'
import { bevel, dither } from './detail'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawText, drawTextCentered, drawTextRight } from './pixelFont'
import { drawTitle } from './pixelFontLarge'
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

export function randomCardNo(rand: () => number = Math.random): string {
  // No prefix: neither № nor # reads clearly in the 3×5 font.
  return `${String(1 + Math.min(99, Math.floor(rand() * 100))).padStart(3, '0')}/100`
}

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, PURPLE, 1, 1, BW - 2, BH - 2, 2)
  dither(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, PURPLE_DARK, 0.06, 11)
  bevel(ctx, { x: 1, y: 1, w: BW - 2, h: BH - 2 }, PURPLE_LIGHT, PURPLE_DARK)

  // Gold name banner.
  panel(ctx, OUTLINE, 4, 4, BW - 8, 13, 2)
  panel(ctx, GOLD, 5, 5, BW - 10, 11, 1)
  bevel(ctx, { x: 6, y: 5, w: BW - 12, h: 11 }, GOLD_LIGHT, GOLD_DARK)
  drawTitle(ctx, values.name ?? '', BW / 2, 3, 84, OUTLINE, undefined, 1)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  // Rivets at the mat's outer corners.
  for (const [x, y] of [[3, 19], [BW - 5, 19], [3, 88], [BW - 5, 88]]) {
    fill(ctx, GOLD, x, y, 2, 2)
    fill(ctx, GOLD_LIGHT, x, y, 1, 1)
  }

  // Type ribbon with notched ends (filled in the body colour, never cleared).
  fill(ctx, OUTLINE, 12, 90, 72, 10)
  fill(ctx, PURPLE_DARK, 13, 91, 70, 8)
  fill(ctx, PURPLE, 12, 93, 2, 4)
  fill(ctx, PURPLE, 82, 93, 2, 4)
  drawTextCentered(ctx, values.type ?? '', BW / 2, 92, CREAM)

  // Stats box: label, 9 pips, number; the card number underneath.
  panel(ctx, OUTLINE, 6, 101, BW - 12, 29, 2)
  panel(ctx, PURPLE_DARK, 7, 102, BW - 14, 27, 1)
  STATS.forEach(({ key, label }, row) => {
    const y = 104 + row * 7
    const raw = values[key] ?? ''
    const n = statValue(raw)
    drawText(ctx, label, 10, y, CREAM)
    for (let i = 0; i < PIPS; i++) {
      fill(ctx, i < n ? GOLD : OUTLINE, 36 + i * 4, y, 3, 5)
      if (i < n) fill(ctx, GOLD_LIGHT, 36 + i * 4, y, 3, 1)
    }
    drawTextRight(ctx, raw, 86, y, GOLD)
  })
  drawTextRight(ctx, values.number ?? '', 86, 124, GOLD)
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
    { key: 'number', label: 'Card no.', default: () => randomCardNo(), maxLength: 9, perCapture: true },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
