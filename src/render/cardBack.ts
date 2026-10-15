import { BLUE_DARK, CREAM, OUTLINE, RED, SHADOW } from '../templates/colors'
import { fill, panel, withDropShadow } from '../templates/draw'
import { drawBigCentered } from '../templates/pixelFontLarge'
import type { Template } from '../templates/types'

// Every template reserves a 3-art-pixel drop-shadow margin on the right and bottom.
const SHADOW_OFFSET = 3

function body(ctx: CanvasRenderingContext2D, w: number, h: number) {
  panel(ctx, OUTLINE, 0, 0, w, h, 3)
  panel(ctx, RED, 1, 1, w - 2, h - 2, 2)
  for (let y = 4; y < h - 4; y++) {
    for (let x = 4; x < w - 4; x++) {
      if ((x + y) % 8 === 0 || (x - y + 8 * h) % 8 === 0) fill(ctx, BLUE_DARK, x, y, 1, 1)
    }
  }
  const cx = Math.floor(w / 2)
  const cy = Math.floor(h / 2)
  // Name plate: RETRATO in the 5×7 font is 41 px, so the plate fits the narrowest card (Tarot, 84 px).
  panel(ctx, OUTLINE, cx - 25, cy - 8, 50, 17, 2)
  panel(ctx, CREAM, cx - 24, cy - 7, 48, 15, 1)
  drawBigCentered(ctx, 'RETRATO', cx, cy - 3, OUTLINE)
}

export function cardBack(template: Template, scale: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const { w, h } = template.size
  const art = document.createElement('canvas')
  art.width = w
  art.height = h
  withDropShadow(art.getContext('2d')!, w - SHADOW_OFFSET, h - SHADOW_OFFSET, SHADOW_OFFSET, SHADOW, (c) =>
    body(c, w - SHADOW_OFFSET, h - SHADOW_OFFSET),
  )
  const out = target ?? document.createElement('canvas')
  out.width = w * scale
  out.height = h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(art, 0, 0, out.width, out.height)
  return out
}
