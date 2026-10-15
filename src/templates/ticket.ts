import { CREAM, GOLD, GOLD_DARK, GOLD_LIGHT, GOLD_MID, OUTLINE, RED, RED_DARK, SHADOW } from './colors'
import { bevel, drawTextVertical, guilloche, verticalLength } from './detail'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered } from './pixelFont'
import { drawBigCentered, drawTitle } from './pixelFontLarge'
import type { Template } from './types'

const BW = 188
const BH = 76
const SHADOW_OFFSET = 3
const PHOTO = { x: 8, y: 6, w: 60, h: 64 }
const STUB = 148
const TEXT_CX = 109
const STUB_CX = 168

const pad = (n: number, len: number) => String(n).padStart(len, '0')

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`
}

export function randomSerial(rand: () => number = Math.random): string {
  return `NO. ${pad(Math.floor(rand() * 1_000_000), 6)}`
}

const SERIAL_TOP = 22
const SERIAL_BOTTOM = BH - 11 // clear of the edition badge in the stub's bottom 9 px

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, GOLD, 1, 1, BW - 2, BH - 2, 2)
  guilloche(ctx, { x: 72, y: 3, w: STUB - 74, h: BH - 6 }, GOLD_MID, 24, 2)
  bevel(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, GOLD_LIGHT, GOLD_DARK)

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

  // ADMIT ONE ribbon with notched ends.
  fill(ctx, OUTLINE, 74, 3, 70, 13)
  fill(ctx, RED, 75, 4, 68, 11)
  // Notched ends: gold, not cleared — clearing here would punch see-through holes in the printed card.
  fill(ctx, GOLD, 74, 8, 2, 3)
  fill(ctx, GOLD, 142, 8, 2, 3)
  drawBigCentered(ctx, 'ADMIT ONE', TEXT_CX, 6, CREAM, 1, RED_DARK)

  panel(ctx, OUTLINE, 74, 20, 70, 20, 2)
  panel(ctx, RED, 75, 21, 68, 18, 1)
  drawTitle(ctx, values.event ?? '', TEXT_CX, 23, 66, CREAM, RED_DARK, 1)

  drawTextCentered(ctx, values.date ?? '', TEXT_CX, 44, OUTLINE)
  drawTextCentered(ctx, values.seat ?? '', TEXT_CX, 52, RED_DARK)
  drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 63, RED_DARK)

  drawTextCentered(ctx, 'ADMIT', STUB_CX, 6, OUTLINE)
  drawTextCentered(ctx, 'ONE', STUB_CX, 13, OUTLINE)
  // Serial runs bottom-to-top down the stub, in the big font when it fits.
  const serial = values.serial ?? ''
  const room = SERIAL_BOTTOM - SERIAL_TOP
  const font = verticalLength(serial, 'big') <= room ? 'big' : 'small'
  let text = serial
  while (text && verticalLength(text, 'small') > room) text = Array.from(text).slice(0, -1).join('')
  const len = verticalLength(text, font)
  const thick = font === 'big' ? 7 : 5
  drawTextVertical(ctx, text, STUB_CX - Math.floor(thick / 2), SERIAL_BOTTOM - Math.floor((room - len) / 2), OUTLINE, font)
}

export const ticket: Template = {
  id: 'ticket',
  name: 'Ticket',
  description: 'Admit-one ticket · event, date & a fresh serial',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  badgeAt: { x: BW - 1, y: BH - 9, align: 'right' }, // bottom of the stub, below the serial
  printSizeMm: { w: 144, h: Math.round(((144 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'event', label: 'Event', default: 'PIXEL PARTY', maxLength: 14 },
    { key: 'date', label: 'Date', default: () => todayIso(), maxLength: 10 },
    { key: 'seat', label: 'Seat', default: 'ROW A SEAT 07', maxLength: 14 },
    { key: 'serial', label: 'Serial', default: () => randomSerial(), maxLength: 10, perCapture: true },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
