import { GOLD, OUTLINE } from '../templates/colors'
import { panel } from '../templates/draw'
import { drawText, measureText } from '../templates/pixelFont'
import type { Edition } from './types'

export interface BadgeAnchor {
  x: number
  y: number
  /** 'right' makes x the badge's right edge, so wider badges grow leftwards. */
  align?: 'left' | 'right'
}

const BADGE_H = 9

export function badgeRect(text: string, anchor: BadgeAnchor = { x: 0, y: 0 }) {
  const w = measureText(text) + 6
  return { x: anchor.align === 'right' ? anchor.x - w : anchor.x, y: anchor.y, w, h: BADGE_H }
}

/** Small gold sticker; templates place it clear of their photo. */
export function drawBadge(ctx: CanvasRenderingContext2D, text: string, anchor?: BadgeAnchor) {
  const r = badgeRect(text, anchor)
  panel(ctx, OUTLINE, r.x, r.y, r.w, r.h, 2)
  panel(ctx, GOLD, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 1)
  drawText(ctx, text, r.x + 3, r.y + 2, OUTLINE)
}

/** Drops overlay pixels wherever the art is not fully opaque (drop shadow, notches). */
export function maskToOpaque(overlay: ImageData, art: ImageData) {
  for (let i = 3; i < overlay.data.length; i += 4) {
    if (art.data[i] < 255) overlay.data[i] = 0
  }
}

/** Paints the edition shimmer onto opaque frame pixels only, then the badge. */
export function applyEdition(
  ctx: CanvasRenderingContext2D,
  edition: Edition,
  w: number,
  h: number,
  angle: number,
  badgeAt?: BadgeAnchor,
) {
  const img = edition.overlay(w, h, angle)
  if (img) {
    maskToOpaque(img, ctx.getImageData(0, 0, w, h))
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.drawImage(tmp, 0, 0)
    ctx.restore()
  }
  if (edition.badge) drawBadge(ctx, edition.badge, badgeAt)
}
