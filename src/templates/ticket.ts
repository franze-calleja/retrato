import { CREAM, GOLD, GOLD_DARK, OUTLINE, RED, RED_DARK, SHADOW } from './colors'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered, fitScale } from './pixelFont'
import type { Template } from './types'

const BW = 188
const BH = 76
const SHADOW_OFFSET = 3
const PHOTO = { x: 8, y: 6, w: 60, h: 64 }
const STUB = 148
const TEXT_CX = 109
const STUB_CX = 168

/** Headline ink; dark on gold so it stays readable. */
export const ADMIT_TEXT = OUTLINE

const pad = (n: number, len: number) => String(n).padStart(len, '0')

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`
}

export function randomSerial(rand: () => number = Math.random): string {
  return `NO. ${pad(Math.floor(rand() * 1_000_000), 6)}`
}

const STUB_CHARS = 9

/** Serial words as stub lines: words longer than the stub wrap onto the next line; at most 3 lines. */
export function serialLines(serial: string): string[] {
  const lines: string[] = []
  for (const word of serial.split(' ').filter(Boolean)) {
    const cps = Array.from(word)
    for (let i = 0; i < cps.length; i += STUB_CHARS) lines.push(cps.slice(i, i + STUB_CHARS).join(''))
  }
  return lines.slice(0, 3)
}

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, GOLD, 1, 1, BW - 2, BH - 2, 2)

  // Side notches and stub notches.
  ctx.clearRect(0, 32, 2, 12)
  ctx.clearRect(2, 34, 1, 8)
  ctx.clearRect(BW - 2, 32, 2, 12)
  ctx.clearRect(BW - 3, 34, 1, 8)
  ctx.clearRect(STUB - 2, 0, 5, 2)
  ctx.clearRect(STUB - 1, 2, 3, 1)
  ctx.clearRect(STUB - 2, BH - 2, 5, 2)
  ctx.clearRect(STUB - 1, BH - 3, 3, 1)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  for (let y = 4; y < BH - 4; y += 4) fill(ctx, OUTLINE, STUB, y, 1, 2)

  drawTextCentered(ctx, 'ADMIT ONE', TEXT_CX, 6, ADMIT_TEXT, 2, GOLD_DARK)

  panel(ctx, OUTLINE, 74, 22, 70, 22, 2)
  panel(ctx, RED, 75, 23, 68, 20, 1)
  const event = values.event ?? ''
  const s = fitScale(event, 64, 2)
  drawTextCentered(ctx, event, TEXT_CX, s === 2 ? 28 : 31, CREAM, s, RED_DARK)

  drawTextCentered(ctx, values.date ?? '', TEXT_CX, 50, OUTLINE)
  drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 62, RED_DARK)

  drawTextCentered(ctx, 'ADMIT', STUB_CX, 8, OUTLINE)
  drawTextCentered(ctx, 'ONE', STUB_CX, 16, OUTLINE)
  serialLines(values.serial ?? '').forEach((line, i) => drawTextCentered(ctx, line, STUB_CX, 34 + i * 8, OUTLINE))
}

export const ticket: Template = {
  id: 'ticket',
  name: 'Ticket',
  description: 'Admit-one ticket · event, date & a fresh serial',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  badgeAt: { x: BW - 1, y: BH - 9, align: 'right' }, // bottom of the stub, below the serial
  printSizeMm: { w: 144, h: 60 },
  fields: [
    { key: 'event', label: 'Event', default: 'PIXEL PARTY', maxLength: 14 },
    { key: 'date', label: 'Date', default: () => todayIso(), maxLength: 10 },
    { key: 'serial', label: 'Serial', default: () => randomSerial(), maxLength: 10, perCapture: true },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
