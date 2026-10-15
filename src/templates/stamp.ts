import { CREAM, CREAM_DARK, GOLD, GOLD_DARK, GOLD_LIGHT, OUTLINE, RED, RED_DARK, RED_LIGHT, RED_MID, SHADOW } from './colors'
import { bevel, hatch, postmark } from './detail'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawText } from './pixelFont'
import { drawTitle } from './pixelFontLarge'
import type { Template } from './types'

const BW = 96
const BH = 120
const SHADOW_OFFSET = 3
const PHOTO = { x: 10, y: 10, w: 76, h: 82 }

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  fill(ctx, OUTLINE, 0, 0, BW, BH)
  fill(ctx, RED, 1, 1, BW - 2, BH - 2)
  hatch(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, RED_MID, 2)
  bevel(ctx, { x: 1, y: 1, w: BW - 2, h: BH - 2 }, RED_LIGHT, RED_DARK)

  // Perforated edge with a shadow inside each notch.
  for (let x = 1; x + 4 <= BW; x += 6) {
    ctx.clearRect(x, 0, 4, 2)
    ctx.clearRect(x + 1, 2, 2, 1)
    fill(ctx, RED_DARK, x + 1, 3, 2, 1)
    ctx.clearRect(x, BH - 2, 4, 2)
    ctx.clearRect(x + 1, BH - 3, 2, 1)
    fill(ctx, RED_DARK, x + 1, BH - 4, 2, 1)
  }
  for (let y = 1; y + 4 <= BH; y += 6) {
    ctx.clearRect(0, y, 2, 4)
    ctx.clearRect(2, y + 1, 1, 2)
    fill(ctx, RED_DARK, 3, y + 1, 1, 2)
    ctx.clearRect(BW - 2, y, 2, 4)
    ctx.clearRect(BW - 3, y + 1, 1, 2)
    fill(ctx, RED_DARK, BW - 4, y + 1, 1, 2)
  }

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  bevel(ctx, { x: PHOTO.x - 3, y: PHOTO.y - 3, w: PHOTO.w + 6, h: PHOTO.h + 6 }, CREAM, CREAM_DARK)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  postmark(ctx, 84, 8, 9, RED_DARK, PHOTO)

  drawTitle(ctx, values.title ?? '', BW / 2, 94, 76, CREAM, RED_DARK, 1)
  drawText(ctx, 'PIXEL POST', 8, 109, GOLD, 1, RED_DARK)

  // Value in the big font on a gold plate, bottom right.
  panel(ctx, OUTLINE, 60, 105, 30, 12, 2)
  panel(ctx, GOLD, 61, 106, 28, 10, 1)
  bevel(ctx, { x: 62, y: 106, w: 26, h: 10 }, GOLD_LIGHT, GOLD_DARK)
  drawTitle(ctx, values.value ?? '', 75, 104, 24, OUTLINE, undefined, 1)
}

export const stamp: Template = {
  id: 'stamp',
  name: 'Stamp',
  description: 'Postage stamp · perforated edge, title & value',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 50, h: Math.round(((50 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'title', label: 'Title', default: 'FIRST STAMP', maxLength: 14 },
    { key: 'value', label: 'Value', default: '25¢', maxLength: 5 },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
