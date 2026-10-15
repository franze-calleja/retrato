import { quantizeAngle } from '../editions/angle'
import { applyEdition } from '../editions/apply'
import type { Edition } from '../editions/types'
import { drawCover, type PhotoSource } from '../photo/crop'
import { shapeSpans } from '../templates/shapes'
import { resolveTemplate } from '../templates/resolve'
import type { Template } from '../templates/types'

export interface ComposeOptions {
  edition?: Edition
  /** Shimmer angle in [0, 1); quantized so the live shimmer reuses cached art. */
  angle?: number
}

// Last rendered frame art per template. The live preview composes every animation frame;
// re-rendering the frame (and its shadow canvases) only when text, edition or angle step changes keeps that cheap.
const artCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>()

function frameArt(template: Template, values: Record<string, string>, opts: ComposeOptions): HTMLCanvasElement {
  const edition = opts.edition
  const angle = edition?.hasEffect ? quantizeAngle(opts.angle ?? 0) : 0
  const key = JSON.stringify([template.fields.map((f) => values[f.key] ?? null), edition?.id ?? null, angle])
  const cached = artCache.get(template.id)
  if (cached?.key === key) return cached.canvas

  const canvas = document.createElement('canvas')
  canvas.width = template.size.w
  canvas.height = template.size.h
  const ctx = canvas.getContext('2d')!
  template.render(ctx, values)
  // With an overlay the photo covers most of the frame, so the badge goes on the overlay instead.
  if (edition) applyEdition(ctx, edition, canvas.width, canvas.height, angle, template.badgeAt, { badge: !template.overlay })
  artCache.set(template.id, { key, canvas })
  return canvas
}

const overlayCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>()

/** Art drawn over the photo (full-art layouts), with the edition shimmer and badge. */
function overlayArt(template: Template, values: Record<string, string>, opts: ComposeOptions): HTMLCanvasElement {
  const edition = opts.edition
  const angle = edition?.hasEffect ? quantizeAngle(opts.angle ?? 0) : 0
  const key = JSON.stringify([template.fields.map((f) => values[f.key] ?? null), edition?.id ?? null, angle])
  const cached = overlayCache.get(template.id)
  if (cached?.key === key) return cached.canvas
  const canvas = document.createElement('canvas')
  canvas.width = template.size.w
  canvas.height = template.size.h
  const ctx = canvas.getContext('2d')!
  template.overlay!(ctx, values)
  if (edition) applyEdition(ctx, edition, canvas.width, canvas.height, angle, template.badgeAt, { badge: true })
  overlayCache.set(template.id, { key, canvas })
  return canvas
}

/** The faded security copy some cards print next to the main photo. */
function drawGhost(ctx: CanvasRenderingContext2D, template: Template, photo: PhotoSource, scale: number) {
  const g = template.ghostRect
  if (!g) return
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.filter = 'grayscale(1)'
  drawCover(ctx, photo, g.x * scale, g.y * scale, g.w * scale, g.h * scale)
  ctx.restore()
}

/**
 * Frame art (with any edition shimmer) is drawn at art scale and upscaled with no smoothing (crisp pixels);
 * the photo is then drawn into photoRect × scale with high-quality smoothing.
 * Shared by preview, download, and print so all three match.
 */
export function composeStamp(
  base: Template,
  photo: PhotoSource,
  values: Record<string, string>,
  scale: number,
  target?: HTMLCanvasElement,
  opts: ComposeOptions = {},
): HTMLCanvasElement {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new RangeError(`scale must be a positive integer, got ${scale}`)
  }
  const template = resolveTemplate(base, values)
  const { w, h } = template.size
  const art = frameArt(template, values, opts)

  const out = target ?? document.createElement('canvas')
  if (out.width !== w * scale) out.width = w * scale
  if (out.height !== h * scale) out.height = h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, out.width, out.height)
  ctx.drawImage(art, 0, 0, out.width, out.height)

  const r = template.photoRect
  const shape = template.photoShape ?? 'rect'
  if (shape === 'rect') drawCover(ctx, photo, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
  else {
    // Clip to the window shape on the art-pixel grid so its edge stays as crisp as the frame.
    ctx.save()
    ctx.beginPath()
    for (const [y, x0, x1] of shapeSpans(r.w, r.h, shape)) {
      ctx.rect((r.x + x0) * scale, (r.y + y) * scale, (x1 - x0) * scale, scale)
    }
    ctx.clip()
    drawCover(ctx, photo, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
    ctx.restore()
  }
  drawGhost(ctx, template, photo, scale)
  if (template.overlay) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(overlayArt(template, values, opts), 0, 0, out.width, out.height)
  }
  return out
}
