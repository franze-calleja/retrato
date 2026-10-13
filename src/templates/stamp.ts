import { CREAM, GOLD, OUTLINE, RED, RED_DARK, SHADOW } from './colors'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawText, drawTextCentered } from './pixelFont'
import type { Template } from './types'

const BW = 96
const BH = 120
const SHADOW_OFFSET = 3
const PHOTO = { x: 12, y: 12, w: 72, h: 84 }

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  fill(ctx, OUTLINE, 0, 0, BW, BH)
  fill(ctx, RED, 1, 1, BW - 2, BH - 2)

  // Perforated edge: a notch every 6px on all four sides.
  for (let x = 1; x + 4 <= BW; x += 6) {
    ctx.clearRect(x, 0, 4, 2)
    ctx.clearRect(x + 1, 2, 2, 1)
    ctx.clearRect(x, BH - 2, 4, 2)
    ctx.clearRect(x + 1, BH - 3, 2, 1)
  }
  for (let y = 1; y + 4 <= BH; y += 6) {
    ctx.clearRect(0, y, 2, 4)
    ctx.clearRect(2, y + 1, 1, 2)
    ctx.clearRect(BW - 2, y, 2, 4)
    ctx.clearRect(BW - 3, y + 1, 1, 2)
  }

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  drawTextCentered(ctx, values.title ?? '', BW / 2, 101, CREAM, 1, RED_DARK)
  drawText(ctx, 'PIXEL POST', 8, 110, GOLD, 1, RED_DARK)

  // Gold value badge, bottom right.
  panel(ctx, OUTLINE, 64, 107, 25, 10, 2)
  panel(ctx, GOLD, 65, 108, 23, 8, 1)
  drawTextCentered(ctx, values.value ?? '', 76, 110, OUTLINE)
}

export const stamp: Template = {
  id: 'stamp',
  name: 'Stamp',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 50, h: 62 },
  fields: [
    { key: 'title', label: 'Title', default: 'FIRST STAMP', maxLength: 14 },
    { key: 'value', label: 'Value', default: '25¢', maxLength: 5 },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
