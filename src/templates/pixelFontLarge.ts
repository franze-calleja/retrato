import { drawBitmap, type Color } from './draw'
import { drawTextCentered, measureText, upperChar } from './pixelFont'

/** 5×7 heading font; the 3×5 font stays for small print. */
export const BIG_ADVANCE = 6
export const TITLE_LINE = 14

export const BIG_GLYPHS: Record<string, readonly string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '¢': ['00100', '01110', '10101', '10100', '10101', '01110', '00100'],
  '★': ['00100', '00100', '11111', '01110', '01110', '11011', '10001'],
  '♥': ['00000', '01010', '11111', '11111', '01110', '00100', '00000'],
  '№': ['10011', '11011', '10111', '10100', '10111', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

const chars = (text: string) => Array.from(text, upperChar)

export const bigGlyphFor = (ch: string): readonly string[] => BIG_GLYPHS[upperChar(ch)] ?? BIG_GLYPHS['?']

export function measureBig(text: string, scale = 1): number {
  const n = chars(text).length
  return n === 0 ? 0 : (n * BIG_ADVANCE - 1) * scale
}

export function drawBig(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: Color, scale = 1, shadow?: Color) {
  const glyphs = chars(text).map(bigGlyphFor)
  if (shadow) glyphs.forEach((g, i) => drawBitmap(ctx, g, x + i * BIG_ADVANCE * scale + scale, y + scale, shadow, scale))
  glyphs.forEach((g, i) => drawBitmap(ctx, g, x + i * BIG_ADVANCE * scale, y, color, scale))
}

export function drawBigCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: Color, scale = 1, shadow?: Color) {
  drawBig(ctx, text, Math.round(cx - measureBig(text, scale) / 2), y, color, scale, shadow)
}

/**
 * Title on a 14 px line starting at `y`, centred on `cx`: the big font at maxScale…1, then the small font at 2…1,
 * whichever first fits maxWidth; if nothing fits, the small font truncated to fit. Returns what it drew.
 */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  color: Color,
  shadow?: Color,
  maxScale = 2,
): { font: 'big' | 'small'; scale: number; width: number } {
  for (let s = maxScale; s >= 1; s--) {
    const w = measureBig(text, s)
    if (w <= maxWidth && 7 * s <= TITLE_LINE) {
      drawBigCentered(ctx, text, cx, y + Math.floor((TITLE_LINE - 7 * s) / 2), color, s, shadow)
      return { font: 'big', scale: s, width: w }
    }
  }
  for (const s of [2, 1]) {
    const w = measureText(text, s)
    if (w <= maxWidth) {
      drawTextCentered(ctx, text, cx, y + Math.floor((TITLE_LINE - 5 * s) / 2), color, s, shadow)
      return { font: 'small', scale: s, width: w }
    }
  }
  let cut = Array.from(text)
  while (cut.length && measureText(cut.join('')) > maxWidth) cut = cut.slice(0, -1)
  const fitted = cut.join('')
  drawTextCentered(ctx, fitted, cx, y + Math.floor((TITLE_LINE - 5) / 2), color, 1, shadow)
  return { font: 'small', scale: 1, width: measureText(fitted) }
}
