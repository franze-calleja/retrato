import { drawCover, type PhotoSource } from '../photo/crop'
import { shapeSpans } from '../templates/shapes'
import type { Template } from '../templates/types'

type Window = Pick<Template, 'photoRect' | 'photoShape'>

/** Canvas size for a camera screen showing a photo window: `width` wide, the window's aspect. */
export function screenSize(t: Pick<Template, 'photoRect'>, width: number) {
  return { w: width, h: Math.max(1, Math.round((width * t.photoRect.h) / t.photoRect.w)) }
}

/** The live feed cropped exactly as it will land on the card, clipped to arch/circle windows. */
export function drawLiveCrop(ctx: CanvasRenderingContext2D, photo: PhotoSource, t: Window, w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  const shape = t.photoShape ?? 'rect'
  if (shape === 'rect') return drawCover(ctx, photo, 0, 0, w, h)
  const kx = w / t.photoRect.w
  const ky = h / t.photoRect.h
  ctx.save()
  ctx.beginPath()
  for (const [y, x0, x1] of shapeSpans(t.photoRect.w, t.photoRect.h, shape)) ctx.rect(x0 * kx, y * ky, (x1 - x0) * kx, ky)
  ctx.clip()
  drawCover(ctx, photo, 0, 0, w, h)
  ctx.restore()
}
