import { drawCover, type PhotoSource } from '../photo/crop'
import type { Template } from '../templates/types'

// Last rendered frame art per template. The live preview composes every animation frame;
// re-rendering the frame (and its shadow canvases) only when the text changes keeps that cheap.
const artCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>()

function frameArt(template: Template, values: Record<string, string>): HTMLCanvasElement {
  const key = JSON.stringify(template.fields.map((f) => values[f.key] ?? null))
  const cached = artCache.get(template.id)
  if (cached?.key === key) return cached.canvas

  const canvas = document.createElement('canvas')
  canvas.width = template.size.w
  canvas.height = template.size.h
  template.render(canvas.getContext('2d')!, values)
  artCache.set(template.id, { key, canvas })
  return canvas
}

/**
 * Frame art is drawn at art scale and upscaled with no smoothing (crisp pixels);
 * the photo is then drawn into photoRect × scale with high-quality smoothing.
 * Shared by preview, download, and print so all three match.
 */
export function composeStamp(
  template: Template,
  photo: PhotoSource,
  values: Record<string, string>,
  scale: number,
  target?: HTMLCanvasElement,
): HTMLCanvasElement {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new RangeError(`scale must be a positive integer, got ${scale}`)
  }
  const { w, h } = template.size
  const art = frameArt(template, values)

  const out = target ?? document.createElement('canvas')
  if (out.width !== w * scale) out.width = w * scale
  if (out.height !== h * scale) out.height = h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, out.width, out.height)
  ctx.drawImage(art, 0, 0, out.width, out.height)

  const r = template.photoRect
  drawCover(ctx, photo, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
  return out
}
