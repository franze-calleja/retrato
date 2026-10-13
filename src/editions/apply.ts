import { GOLD, OUTLINE } from '../templates/colors'
import { panel } from '../templates/draw'
import { drawText, measureText } from '../templates/pixelFont'
import type { Edition } from './types'

/** Small gold sticker at the art's top-left corner. */
export function drawBadge(ctx: CanvasRenderingContext2D, text: string) {
  const tw = measureText(text)
  panel(ctx, OUTLINE, 0, 0, tw + 6, 9, 2)
  panel(ctx, GOLD, 1, 1, tw + 4, 7, 1)
  drawText(ctx, text, 3, 2, OUTLINE)
}

/** Paints the edition shimmer onto opaque frame pixels only, then the badge. */
export function applyEdition(ctx: CanvasRenderingContext2D, edition: Edition, w: number, h: number, angle: number) {
  const img = edition.overlay(w, h, angle)
  if (img) {
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.drawImage(tmp, 0, 0)
    ctx.restore()
  }
  if (edition.badge) drawBadge(ctx, edition.badge)
}
