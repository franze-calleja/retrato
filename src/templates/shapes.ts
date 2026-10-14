import type { Color } from './draw'
import { fill } from './draw'
import type { Rect } from './types'

export type PhotoShape = 'rect' | 'circle' | 'arch'

/** Horizontal pixel spans [y, x0, x1) covering a shape inside a w×h box (art pixels). */
export function shapeSpans(w: number, h: number, shape: PhotoShape): [number, number, number][] {
  const spans: [number, number, number][] = []
  for (let y = 0; y < h; y++) {
    if (shape === 'rect') {
      spans.push([y, 0, w])
      continue
    }
    const r = shape === 'circle' ? Math.min(w, h) / 2 : w / 2
    const cy = shape === 'circle' ? h / 2 : r
    const dy = y + 0.5 - cy
    if (shape === 'arch' && dy >= 0) {
      spans.push([y, 0, w])
      continue
    }
    if (Math.abs(dy) >= r) continue
    const half = Math.sqrt(r * r - dy * dy)
    const x0 = Math.round(w / 2 - half)
    const x1 = Math.round(w / 2 + half)
    if (x1 > x0) spans.push([y, x0, x1])
  }
  return spans
}

export function fillShape(ctx: CanvasRenderingContext2D, color: Color, rect: Rect, shape: PhotoShape) {
  for (const [y, x0, x1] of shapeSpans(rect.w, rect.h, shape)) fill(ctx, color, rect.x + x0, rect.y + y, x1 - x0, 1)
}

/** Grows a rect by n art pixels on every side. */
export const grow = (r: Rect, n: number): Rect => ({ x: r.x - n, y: r.y - n, w: r.w + 2 * n, h: r.h + 2 * n })
