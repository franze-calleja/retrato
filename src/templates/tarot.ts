import { SEPIA_DARK, SEPIA_INK, SEPIA_LIGHT, SEPIA_MID, SHADOW } from './colors'
import { dither } from './detail'
import { drawBitmap, outline, panel, withDropShadow } from './draw'
import { drawTextCentered } from './pixelFont'
import { drawTitle } from './pixelFontLarge'
import { fillShape, grow } from './shapes'
import type { Template } from './types'

const BW = 84
const BH = 144
const SHADOW_OFFSET = 3
const PHOTO = { x: 12, y: 24, w: 60, h: 86 }

export const ARCANA = [
  'THE FOOL', 'THE MAGICIAN', 'THE HIGH PRIESTESS', 'THE EMPRESS', 'THE EMPEROR', 'THE HIEROPHANT',
  'THE LOVERS', 'THE CHARIOT', 'STRENGTH', 'THE HERMIT', 'WHEEL OF FORTUNE', 'JUSTICE',
  'THE HANGED MAN', 'DEATH', 'TEMPERANCE', 'THE DEVIL', 'THE TOWER', 'THE STAR',
  'THE MOON', 'THE SUN', 'JUDGEMENT', 'THE WORLD',
].map((title, i) => ({ numeral: toRoman(i), title }))

// Guests probably don't want these printed under their face; they can still type them.
const GLOOMY = new Set(['THE HANGED MAN', 'DEATH', 'THE DEVIL', 'THE TOWER'])
export const FRIENDLY_ARCANA = ARCANA.filter((a) => !GLOOMY.has(a.title))

function toRoman(n: number): string {
  if (n === 0) return '0'
  const table: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [v, s] of table) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

export function randomArcana(rand: () => number = Math.random): string {
  return FRIENDLY_ARCANA[Math.floor(rand() * FRIENDLY_ARCANA.length)].title
}

export function numeralFor(title: string): string {
  const t = title.trim().toUpperCase()
  return ARCANA.find((a) => a.title === t)?.numeral ?? ''
}

const STAR5 = ['00100', '01110', '11111', '01110', '00100']
const MOON5 = ['01110', '11000', '10000', '11000', '01110']

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, SEPIA_INK, 0, 0, BW, BH, 3)
  panel(ctx, SEPIA_LIGHT, 1, 1, BW - 2, BH - 2, 2)
  dither(ctx, { x: 6, y: 6, w: BW - 12, h: BH - 12 }, SEPIA_MID, 0.16, 5)
  outline(ctx, SEPIA_DARK, 3, 3, BW - 6, BH - 6)
  outline(ctx, SEPIA_MID, 5, 5, BW - 10, BH - 10)

  // Numeral tab.
  const numeral = numeralFor(values.title ?? '')
  if (numeral) {
    // y 8 leaves a pixel between the tab and the edition badge's corner.
    panel(ctx, SEPIA_INK, 30, 8, 24, 11, 2)
    panel(ctx, SEPIA_LIGHT, 31, 9, 22, 9, 1)
    drawTextCentered(ctx, numeral, BW / 2, 11, SEPIA_INK)
  }

  // Arched window: tan mat, ink rim; the composer clips the photo to the same arch.
  fillShape(ctx, SEPIA_MID, grow(PHOTO, 3), 'arch')
  fillShape(ctx, SEPIA_INK, grow(PHOTO, 1), 'arch')
  // Star and crescent in the spandrels beside the arch.
  drawBitmap(ctx, STAR5, 11, 24, SEPIA_DARK)
  drawBitmap(ctx, MOON5, 68, 24, SEPIA_DARK)

  // Title plate.
  // Spans the inner border so the longest title (THE HIGH PRIESTESS, 71 px) fits whole.
  panel(ctx, SEPIA_INK, 4, 116, BW - 8, 16, 2)
  panel(ctx, SEPIA_LIGHT, 5, 117, BW - 10, 14, 1)
  drawTitle(ctx, values.title ?? '', BW / 2, 117, 72, SEPIA_INK, undefined, 1)
  drawTextCentered(ctx, 'PIXEL TAROT', BW / 2, 133, SEPIA_DARK)
}

export const tarot: Template = {
  id: 'tarot',
  name: 'Tarot Card',
  description: 'You as a major arcana · THE STAR, THE SUN & friends',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  photoShape: 'arch',
  printSizeMm: { w: 70, h: Math.round(((70 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [{ key: 'title', label: 'Title', default: () => randomArcana(), maxLength: 18, perCapture: true }],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
