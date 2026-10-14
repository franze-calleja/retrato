import { CREAM, GOLD, OUTLINE, PURPLE, PURPLE_DARK, SHADOW } from '../templates/colors'
import { fill, outline, panel, withDropShadow } from '../templates/draw'
import { drawTextCentered } from '../templates/pixelFont'
import type { Template } from '../templates/types'

const BW = 96
const BH = 132
const SHADOW_OFFSET = 3
const PHOTO = { x: 12, y: 10, w: 72, h: 96 }

function body(ctx: CanvasRenderingContext2D) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, PURPLE, 1, 1, BW - 2, BH - 2, 2)
  for (let y = 3; y < BH - 3; y++) {
    for (let x = 3; x < BW - 3; x++) if ((x + y) % 10 === 0) fill(ctx, PURPLE_DARK, x, y, 1, 1)
  }
  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  drawTextCentered(ctx, 'BOOSTER PACK', BW / 2, 112, CREAM, 1, PURPLE_DARK)
  drawTextCentered(ctx, 'SMILE!', BW / 2, 121, GOLD, 1, PURPLE_DARK)
}

/** Booth frame for pack mode. Not in the registry, so it can't be picked or dealt. */
export const packViewfinder: Template = {
  id: 'pack-viewfinder',
  name: 'Booster Pack',
  description: '',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 50, h: 69 },
  fields: [],
  render(ctx) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, body)
  },
}
