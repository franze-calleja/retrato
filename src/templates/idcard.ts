import { CREAM, CREAM_DARK, GOLD, GOLD_DARK, GOLD_LIGHT, OUTLINE, RED, RED_DARK, SHADOW, SILVER, SILVER_DARK, SILVER_LIGHT } from './colors'
import { bevel, guilloche } from './detail'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawText } from './pixelFont'
import { drawTitle, titleFit } from './pixelFontLarge'
import { todayIso } from './ticket'
import type { Template } from './types'

const BW = 160
const BH = 101
const SHADOW_OFFSET = 3
const PHOTO = { x: 8, y: 26, w: 48, h: 60 }
const COL_X = 64 // right-hand text column

export function randomMember(rand: () => number = Math.random): string {
  return `NO. ${String(Math.floor(rand() * 10_000)).padStart(4, '0')}`
}

/** Same day next year; Feb 29 falls back to Feb 28. */
export function validUntil(now = new Date()): string {
  const d = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
  if (d.getMonth() !== now.getMonth()) d.setDate(0)
  return todayIso(d)
}

/** Deterministic bar pattern (FNV-1a) so the barcode always matches its member number. */
export function barcodeBars(text: string, width: number): boolean[] {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619)
  return Array.from({ length: width }, (_, i) => {
    if (i < 2 || i >= width - 2) return true
    h = Math.imul(h ^ i, 16777619) >>> 0
    return ((h >>> 9) & 1) === 1
  })
}

const BARCODE = { x: COL_X, y: 84, w: 64, h: 10 }
const COL_W = 64
const CHIP = { x: 132, y: 24, w: 18, h: 14 }
const GHOST = { x: 136, y: 70, w: 16, h: 20 }
const HOLO = { x: 8, y: 89, w: 22, h: 9 }

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, CREAM, 1, 1, BW - 2, BH - 2, 2)
  guilloche(ctx, { x: 58, y: 21, w: BW - 61, h: BH - 24 }, CREAM_DARK, 20, 2)

  // Red header with the organisation name.
  panel(ctx, RED, 1, 1, BW - 2, 18, 2)
  fill(ctx, RED, 1, 10, BW - 2, 9)
  fill(ctx, OUTLINE, 1, 19, BW - 2, 1)
  drawTitle(ctx, values.org ?? '', BW / 2, 3, 140, CREAM, RED_DARK, 2)

  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  // Contact chip.
  panel(ctx, OUTLINE, CHIP.x - 1, CHIP.y - 1, CHIP.w + 2, CHIP.h + 2, 2)
  panel(ctx, GOLD, CHIP.x, CHIP.y, CHIP.w, CHIP.h, 1)
  bevel(ctx, { x: CHIP.x + 1, y: CHIP.y, w: CHIP.w - 2, h: CHIP.h }, GOLD_LIGHT, GOLD_DARK)
  fill(ctx, GOLD_DARK, CHIP.x + 6, CHIP.y + 2, 1, CHIP.h - 4)
  fill(ctx, GOLD_DARK, CHIP.x + 11, CHIP.y + 2, 1, CHIP.h - 4)
  fill(ctx, GOLD_DARK, CHIP.x + 2, CHIP.y + 5, CHIP.w - 4, 1)
  fill(ctx, GOLD_DARK, CHIP.x + 2, CHIP.y + 9, CHIP.w - 4, 1)

  drawText(ctx, 'MEMBER', COL_X, 26, RED)
  const name = values.name ?? ''
  const fit = titleFit(name, COL_W, 1)
  drawTitle(ctx, name, COL_X + fit.width / 2, 31, COL_W, OUTLINE, undefined, 1)
  drawText(ctx, values.member ?? '', COL_X, 46, OUTLINE)
  drawText(ctx, 'VALID UNTIL', COL_X, 56, RED)
  drawText(ctx, values.valid ?? '', COL_X, 64, OUTLINE)

  barcodeBars(values.member ?? '', BARCODE.w).forEach((on, i) => {
    if (on) fill(ctx, OUTLINE, BARCODE.x + i, BARCODE.y, 1, BARCODE.h)
  })

  // Ghost photo keyline (the composer draws the faded photo inside it).
  outline(ctx, CREAM_DARK, GHOST.x - 1, GHOST.y - 1, GHOST.w + 2, GHOST.h + 2)

  // Hologram patch: silver with diagonal stripes; editions make it shimmer.
  fill(ctx, SILVER, HOLO.x, HOLO.y, HOLO.w, HOLO.h)
  for (let y = 0; y < HOLO.h; y++)
    for (let x = 0; x < HOLO.w; x++) {
      const d = (x + y) % 4
      if (d === 0) fill(ctx, SILVER_LIGHT, HOLO.x + x, HOLO.y + y, 1, 1)
      else if (d === 2) fill(ctx, SILVER_DARK, HOLO.x + x, HOLO.y + y, 1, 1)
    }
  outline(ctx, SILVER_DARK, HOLO.x - 1, HOLO.y - 1, HOLO.w + 2, HOLO.h + 2)

  // Micro-text security line.
  for (let x = 34, i = 0; x < BW - 4; x++, i++) if (i % 9 < 7 && i % 2 === 0) fill(ctx, RED_DARK, x, BH - 4, 1, 1)
}

export const idcard: Template = {
  id: 'id',
  name: 'ID Card',
  description: 'Member card · club name, member no. & barcode',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  ghostRect: GHOST,
  printSizeMm: { w: 85.6, h: Math.round(((85.6 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'org', label: 'Organisation', default: 'PIXEL CLUB', maxLength: 12 },
    { key: 'name', label: 'Name', default: 'GUEST', maxLength: 14 },
    { key: 'member', label: 'Member no.', default: () => randomMember(), maxLength: 9, perCapture: true },
    { key: 'valid', label: 'Valid until', default: () => validUntil(), maxLength: 10 },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
