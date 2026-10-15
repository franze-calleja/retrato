import { drawBitmap, type Color } from './draw'

const ADVANCE = 4 // 3px glyph + 1px gap

export const GLYPHS: Record<string, readonly string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '110', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '110'],
  ' ': ['000', '000', '000', '000', '000'],
  '.': ['000', '000', '000', '000', '010'],
  ',': ['000', '000', '000', '010', '100'],
  ':': ['000', '010', '000', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '!': ['010', '010', '010', '000', '010'],
  '?': ['110', '001', '010', '000', '010'],
  "'": ['010', '010', '000', '000', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '#': ['101', '111', '101', '111', '101'],
  $: ['011', '110', '010', '011', '110'],
  '%': ['101', '001', '010', '100', '101'],
  '&': ['010', '101', '010', '101', '011'],
  '+': ['000', '010', '111', '010', '000'],
  '*': ['101', '010', '101', '000', '000'],
  '¢': ['010', '111', '100', '111', '010'],
  '★': ['010', '111', '010', '101', '000'],
}

// Uppercase per character: ß→SS or ﬁ→FI would otherwise grow the text past its slot.
export const upperChar = (ch: string) => {
  const u = ch.toUpperCase()
  return Array.from(u)[0] // ß→S, ﬁ→F: one slot, and a letter rather than ?
}
const chars = (text: string) => Array.from(text, upperChar)

export function glyphFor(ch: string): readonly string[] {
  return GLYPHS[upperChar(ch)] ?? GLYPHS['?']
}

export function measureText(text: string, scale = 1): number {
  const n = chars(text).length
  return n === 0 ? 0 : (n * ADVANCE - 1) * scale
}

export function fitScale(text: string, maxWidth: number, maxScale: number): number {
  for (let s = maxScale; s > 1; s--) {
    if (measureText(text, s) <= maxWidth) return s
  }
  return 1
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: Color,
  scale = 1,
  shadow?: Color,
) {
  const glyphs = chars(text).map(glyphFor)
  if (shadow) glyphs.forEach((g, i) => drawBitmap(ctx, g, x + i * ADVANCE * scale + scale, y + scale, shadow, scale))
  glyphs.forEach((g, i) => drawBitmap(ctx, g, x + i * ADVANCE * scale, y, color, scale))
}

export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  color: Color,
  scale = 1,
  shadow?: Color,
) {
  drawText(ctx, text, Math.round(centerX - measureText(text, scale) / 2), y, color, scale, shadow)
}

export function drawTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  right: number,
  y: number,
  color: Color,
  scale = 1,
  shadow?: Color,
) {
  drawText(ctx, text, right - measureText(text, scale), y, color, scale, shadow)
}

/** Greedy word wrap to maxWidth (art px); words wider than a line are split; at most maxLines lines. */
export function wrapText(text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  const push = (l: string) => {
    if (l) lines.push(l)
  }
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word
    while (measureText(w) > maxWidth) {
      let cut = Array.from(w).length - 1
      while (cut > 1 && measureText(Array.from(w).slice(0, cut).join('')) > maxWidth) cut--
      push(line)
      line = ''
      push(Array.from(w).slice(0, cut).join(''))
      w = Array.from(w).slice(cut).join('')
    }
    const candidate = line ? `${line} ${w}` : w
    if (measureText(candidate) <= maxWidth) line = candidate
    else {
      push(line)
      line = w
    }
  }
  push(line)
  return lines.slice(0, maxLines)
}
