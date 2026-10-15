import { css, drawBitmap, fill, type Color, type Rect } from './draw'
import { drawText, measureText } from './pixelFont'
import { drawBig, measureBig } from './pixelFontLarge'

// Pixel-detail helpers on the art grid. Everything is drawn with fill/fillRect so editions treat it as frame.

const hash = (x: number, y: number, seed: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
  return n - Math.floor(n)
}

const hits = (x: number, y: number, r?: Rect) => !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

/** Light edge top/left, dark edge bottom/right, 1 px inside `r`. */
export function bevel(ctx: CanvasRenderingContext2D, r: Rect, light: Color, dark: Color) {
  fill(ctx, light, r.x, r.y, r.w, 1)
  fill(ctx, light, r.x, r.y, 1, r.h)
  fill(ctx, dark, r.x, r.y + r.h - 1, r.w, 1)
  fill(ctx, dark, r.x + r.w - 1, r.y, 1, r.h)
}

/** Deterministic speckle texture (paper grain, linen). */
export function dither(ctx: CanvasRenderingContext2D, r: Rect, color: Color, density: number, seed = 0) {
  ctx.fillStyle = css(color) // set once: these helpers paint thousands of single pixels
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) if (hash(x, y, seed) < density) ctx.fillRect(x, y, 1, 1)
}

/** Engraved horizontal line pattern. */
export function hatch(ctx: CanvasRenderingContext2D, r: Rect, color: Color, step: number) {
  for (let y = r.y; y < r.y + r.h; y += step) fill(ctx, color, r.x, y, r.w, 1)
}

const FLOURISH = ['11110', '10000', '10110', '10010', '00000']
const flipH = (rows: readonly string[]) => rows.map((row) => [...row].reverse().join(''))
const flipV = (rows: readonly string[]) => [...rows].reverse()

export type Corner = 'tl' | 'tr' | 'bl' | 'br'

/** A small flourish in each inner corner of `r`, except any listed in `skip` (e.g. where a badge sits). */
export function cornerOrnaments(ctx: CanvasRenderingContext2D, r: Rect, color: Color, skip: readonly Corner[] = []) {
  const right = r.x + r.w - 5
  const bottom = r.y + r.h - 5
  if (!skip.includes('tl')) drawBitmap(ctx, FLOURISH, r.x, r.y, color)
  if (!skip.includes('tr')) drawBitmap(ctx, flipH(FLOURISH), right, r.y, color)
  if (!skip.includes('bl')) drawBitmap(ctx, flipV(FLOURISH), r.x, bottom, color)
  if (!skip.includes('br')) drawBitmap(ctx, flipV(flipH(FLOURISH)), right, bottom, color)
}

/** Banknote-style pattern: two interleaved sine lines, repeated every 4 px down `r`. */
export function guilloche(ctx: CanvasRenderingContext2D, r: Rect, color: Color, period: number, amplitude: number) {
  ctx.fillStyle = css(color)
  for (let base = r.y + amplitude; base < r.y + r.h - amplitude; base += 4)
    for (let x = r.x; x < r.x + r.w; x++) {
      const t = (2 * Math.PI * (x - r.x)) / period
      for (const phase of [0, Math.PI]) {
        const y = Math.round(base + amplitude * Math.sin(t + phase))
        if (y >= r.y && y < r.y + r.h) ctx.fillRect(x, y, 1, 1)
      }
    }
}

/** 1 px pixel circle (midpoint algorithm); skips pixels inside `avoid`. */
export function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: Color, avoid?: Rect) {
  let x = r
  let y = 0
  let err = 1 - r
  const plot = (px: number, py: number) => {
    if (!hits(px, py, avoid)) fill(ctx, color, px, py, 1, 1)
  }
  while (x >= y) {
    for (const [dx, dy] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) plot(cx + dx, cy + dy)
    y++
    if (err < 0) err += 2 * y + 1
    else {
      x--
      err += 2 * (y - x) + 1
    }
  }
}

/** Postal cancellation: two rings and three wavy cancel lines to their left. */
export function postmark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: Color, avoid?: Rect) {
  ring(ctx, cx, cy, r, color, avoid)
  ring(ctx, cx, cy, r - 2, color, avoid)
  for (let i = -1; i <= 1; i++)
    for (let x = cx - r - 18; x < cx - r - 1; x++) {
      const y = cy + i * 3 + Math.round(Math.sin(x / 2))
      if (!hits(x, y, avoid)) fill(ctx, color, x, y, 1, 1)
    }
}

/** Length along the column of rotated text. */
export const verticalLength = (text: string, font: 'big' | 'small') => (font === 'big' ? measureBig(text) : measureText(text))

/**
 * Text turned a quarter left (reads bottom to top). It fills columns x … x+thickness−1 and rows y−length … y−1,
 * so `y` is the exclusive bottom. A shadow, if given, falls up-right in screen terms (local +1,+1).
 */
export function drawTextVertical(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: Color, font: 'big' | 'small', shadow?: Color) {
  ctx.save()
  // Exact quarter turn (rotate(-π/2) leaves ~1e-16 skew terms): local (u, v) → screen (x + v, y − u).
  ctx.transform(0, -1, 1, 0, x, y)
  if (font === 'big') drawBig(ctx, text, 0, 0, color, 1, shadow)
  else drawText(ctx, text, 0, 0, color, 1, shadow)
  ctx.restore()
}
