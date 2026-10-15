import { BLUE, BLUE_DARK, BLUE_MID, CREAM, GOLD, GOLD_DARK, GOLD_LIGHT, OUTLINE, SHADOW } from './colors'
import { bevel, cornerOrnaments, dither, ring } from './detail'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered } from './pixelFont'
import { drawBigCentered, drawTitle } from './pixelFontLarge'
import type { Template } from './types'

const BW = 188
const BH = 92
const SHADOW_OFFSET = 3
const PHOTO = { x: 6, y: 6, w: 72, h: 80 }
const CUT = 146
const TEXT_CX = 113 // center of the 84..142 text column
const STUB_CX = 167

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, BLUE, 1, 1, BW - 2, BH - 2, 2)
  dither(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, BLUE_MID, 0.08, 7)
  // Double border with corner flourishes.
  outline(ctx, CREAM, 3, 3, BW - 6, BH - 6)
  outline(ctx, GOLD, 5, 5, BW - 10, BH - 10)
  cornerOrnaments(ctx, { x: 7, y: 7, w: BW - 14, h: BH - 14 }, GOLD)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  // Dashed cut line with notches top and bottom.
  for (let y = 6; y < BH - 6; y += 5) fill(ctx, CREAM, CUT, y, 1, 3)
  ctx.clearRect(CUT - 2, 0, 5, 2)
  ctx.clearRect(CUT - 1, 2, 3, 1)
  ctx.clearRect(CUT - 2, BH - 2, 5, 2)
  ctx.clearRect(CUT - 1, BH - 3, 3, 1)

  drawTitle(ctx, values.title ?? '', TEXT_CX, 7, 56, CREAM, BLUE_DARK, 2)

  // Value plate.
  panel(ctx, OUTLINE, 84, 24, 58, 26, 2)
  panel(ctx, GOLD, 85, 25, 56, 24, 1)
  bevel(ctx, { x: 86, y: 25, w: 54, h: 24 }, GOLD_LIGHT, GOLD_DARK)
  drawTitle(ctx, values.amount ?? '', TEXT_CX, 30, 52, OUTLINE, undefined, 2)

  drawTextCentered(ctx, 'VALID UNTIL', TEXT_CX, 55, GOLD, 1, BLUE_DARK)
  drawTitle(ctx, values.expires ?? '', TEXT_CX, 60, 56, CREAM, BLUE_DARK, 1)
  drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 80, GOLD, 1, BLUE_DARK)

  // Round seal on the stub.
  ring(ctx, STUB_CX, 48, 15, CREAM)
  ring(ctx, STUB_CX, 48, 13, GOLD)
  drawBigCentered(ctx, '★', STUB_CX, 37, GOLD)
  drawTextCentered(ctx, 'PIXEL', STUB_CX, 47, CREAM)
  drawTextCentered(ctx, 'BOOTH', STUB_CX, 54, CREAM)
}

export const voucher: Template = {
  id: 'voucher',
  name: 'Voucher',
  description: 'Coupon with a tear-off stub · title, amount & expiry',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  badgeAt: { x: BW - 1, y: 0, align: 'right' }, // top of the stub
  printSizeMm: { w: 120, h: Math.round(((120 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'title', label: 'Title', default: 'VOUCHER', maxLength: 14 },
    { key: 'amount', label: 'Amount', default: 'FREE HUG', maxLength: 12 },
    { key: 'expires', label: 'Expires', default: 'TODAY', maxLength: 14 },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
