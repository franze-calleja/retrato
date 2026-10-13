import { BLUE, BLUE_DARK, CREAM, GOLD, OUTLINE, RED, SHADOW } from './colors'
import { drawBitmap, fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered, fitScale } from './pixelFont'
import type { Template } from './types'

const BW = 188
const BH = 92
const SHADOW_OFFSET = 3
const PHOTO = { x: 6, y: 6, w: 72, h: 80 }
const CUT = 146
const TEXT_CX = 113 // center of the 84..142 text column
const STUB_CX = 167

const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000']

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, BLUE, 1, 1, BW - 2, BH - 2, 2)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  // Dashed cut line with notches top and bottom.
  for (let y = 6; y < BH - 6; y += 5) fill(ctx, CREAM, CUT, y, 1, 3)
  ctx.clearRect(CUT - 2, 0, 5, 2)
  ctx.clearRect(CUT - 1, 2, 3, 1)
  ctx.clearRect(CUT - 2, BH - 2, 5, 2)
  ctx.clearRect(CUT - 1, BH - 3, 3, 1)

  const title = values.title ?? ''
  const ts = fitScale(title, 58, 2)
  drawTextCentered(ctx, title, TEXT_CX, ts === 2 ? 8 : 10, CREAM, ts, BLUE_DARK)

  panel(ctx, OUTLINE, 84, 30, 58, 24, 2)
  panel(ctx, GOLD, 85, 31, 56, 22, 1)
  const amount = values.amount ?? ''
  const as = fitScale(amount, 52, 2)
  drawTextCentered(ctx, amount, TEXT_CX, as === 2 ? 37 : 40, OUTLINE, as)

  drawTextCentered(ctx, values.expires ?? '', TEXT_CX, 62, CREAM, 1, BLUE_DARK)
  drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 76, GOLD, 1, BLUE_DARK)

  drawTextCentered(ctx, 'KEEP', STUB_CX, 26, CREAM, 1, BLUE_DARK)
  drawBitmap(ctx, HEART, STUB_CX - 3, 39, RED)
  drawTextCentered(ctx, 'THIS', STUB_CX, 54, CREAM, 1, BLUE_DARK)
}

export const voucher: Template = {
  id: 'voucher',
  name: 'Voucher',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 120, h: 60 },
  fields: [
    { key: 'title', label: 'Title', default: 'VOUCHER', maxLength: 14 },
    { key: 'amount', label: 'Amount', default: 'FREE HUG', maxLength: 12 },
    { key: 'expires', label: 'Expires', default: 'VALID TODAY', maxLength: 14 },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
