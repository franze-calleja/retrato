import { CREAM, GOLD, OUTLINE, SHADOW } from '../templates/colors'
import { fill, outline, panel, withDropShadow } from '../templates/draw'
import { drawTextCentered } from '../templates/pixelFont'
import type { Template } from '../templates/types'
import type { PackDef } from './catalog'

const BW = 96
const BH = 132
const SHADOW_OFFSET = 3
const PHOTO = { x: 12, y: 10, w: 72, h: 96 }

function body(ctx: CanvasRenderingContext2D, pack: PackDef) {
  const { body: bg, stripe } = pack.art
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, bg, 1, 1, BW - 2, BH - 2, 2)
  for (let y = 3; y < BH - 3; y++) {
    for (let x = 3; x < BW - 3; x++) if ((x + y) % 10 === 0) fill(ctx, stripe, x, y, 1, 1)
  }
  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  drawTextCentered(ctx, pack.name, BW / 2, 112, CREAM, 1, stripe)
  drawTextCentered(ctx, 'SMILE!', BW / 2, 121, GOLD, 1, stripe)
}

const cache = new Map<string, Template>()

/** Booth frame for a pack. Not in the registry, so it can't be picked or dealt. One instance per pack. */
export function packViewfinder(pack: PackDef): Template {
  let t = cache.get(pack.id)
  if (!t) {
    t = {
      id: `pack-viewfinder-${pack.id}`,
      name: pack.name,
      description: '',
      size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
      photoRect: PHOTO,
      printSizeMm: { w: 50, h: 69 },
      fields: [],
      render(ctx) {
        withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, pack))
      },
    }
    cache.set(pack.id, t)
  }
  return t
}
