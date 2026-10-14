import { GOLD, GOLD_DARK, NAVY, OUTLINE, SHADOW } from './colors'
import { drawBitmap, outline, panel, withDropShadow } from './draw'
import { drawTextCentered, fitScale } from './pixelFont'
import { fillShape, grow } from './shapes'
import type { Template } from './types'

const BW = 84
const BH = 144
const SHADOW_OFFSET = 3
const PHOTO = { x: 12, y: 24, w: 60, h: 86 }
const DIAMOND = ['010', '111', '010']

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

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, NAVY, 1, 1, BW - 2, BH - 2, 2)
  outline(ctx, GOLD, 3, 3, BW - 6, BH - 6)
  outline(ctx, GOLD_DARK, 5, 5, BW - 10, BH - 10)
  for (const [x, y] of [[7, 7], [BW - 10, 7], [7, BH - 10], [BW - 10, BH - 10]]) drawBitmap(ctx, DIAMOND, x, y, GOLD)

  // Numeral plate.
  const numeral = numeralFor(values.title ?? '')
  if (numeral) {
    panel(ctx, OUTLINE, 30, 8, 24, 11, 2)
    panel(ctx, GOLD, 31, 9, 22, 9, 1)
    drawTextCentered(ctx, numeral, BW / 2, 11, OUTLINE)
  }

  // Arched window: gold mat, dark rim; the composer clips the photo to the same arch.
  fillShape(ctx, GOLD, grow(PHOTO, 3), 'arch')
  fillShape(ctx, OUTLINE, grow(PHOTO, 1), 'arch')

  // Title plate.
  panel(ctx, OUTLINE, 6, 116, BW - 12, 16, 2)
  panel(ctx, GOLD, 7, 117, BW - 14, 14, 1)
  const title = values.title ?? ''
  const s = fitScale(title, BW - 20, 2)
  drawTextCentered(ctx, title, BW / 2, s === 2 ? 119 : 122, OUTLINE, s)
  drawTextCentered(ctx, 'PIXEL TAROT', BW / 2, 134, GOLD_DARK)
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
