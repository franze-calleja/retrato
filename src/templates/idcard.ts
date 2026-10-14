import { CREAM, OUTLINE, RED, RED_DARK, SHADOW } from './colors'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawText, drawTextCentered, fitScale } from './pixelFont'
import { todayIso } from './ticket'
import type { Template } from './types'

const BW = 160
const BH = 101
const SHADOW_OFFSET = 3
const PHOTO = { x: 8, y: 26, w: 48, h: 60 }
const COL_X = 64 // right-hand text column
const BARCODE = { x: COL_X, y: 84, w: 88, h: 10 }

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

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, CREAM, 1, 1, BW - 2, BH - 2, 2)

  // Red header with the organisation name.
  panel(ctx, RED, 1, 1, BW - 2, 18, 2)
  fill(ctx, RED, 1, 10, BW - 2, 9)
  fill(ctx, OUTLINE, 1, 19, BW - 2, 1)
  const org = values.org ?? ''
  const os = fitScale(org, 94, 2)
  drawTextCentered(ctx, org, BW / 2, os === 2 ? 5 : 8, CREAM, os, RED_DARK)

  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  drawText(ctx, 'MEMBER', COL_X, 28, RED)
  const name = values.name ?? ''
  const ns = fitScale(name, 88, 2)
  drawText(ctx, name, COL_X, ns === 2 ? 36 : 38, OUTLINE, ns)
  drawText(ctx, values.member ?? '', COL_X, 54, OUTLINE)
  drawText(ctx, 'VALID UNTIL', COL_X, 64, RED)
  drawText(ctx, values.valid ?? '', COL_X, 72, OUTLINE)

  barcodeBars(values.member ?? '', BARCODE.w).forEach((on, i) => {
    if (on) fill(ctx, OUTLINE, BARCODE.x + i, BARCODE.y, 1, BARCODE.h)
  })
}

export const idcard: Template = {
  id: 'id',
  name: 'ID Card',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
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
