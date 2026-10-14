import { CREAM, GOLD, OUTLINE, PURPLE, RED, SHADOW } from './colors'
import { drawBitmap, fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered, fitScale, wrapText } from './pixelFont'
import type { Template } from './types'

const BW = 96
const BH = 132
const SHADOW_OFFSET = 3
const PHOTO = { x: 14, y: 34, w: 68, h: 52 }
const EFFECT_WIDTH = 70

export const JESTER_EFFECTS = [
  'DOUBLES ALL SNACKS',
  '+10 DANCE MOVES',
  'RETRIGGERS LAUGHTER',
  '+4 TO VIBES',
  'X2 CHAOS ON FRIDAYS',
  'ALL SMILES SCORE TWICE',
  'COPIES THE BEST POSE',
  '+1 HIGH FIVE PER ROUND',
  'TURNS FROWNS UPSIDE DOWN',
]

export const randomJesterEffect = (rand: () => number = Math.random) =>
  JESTER_EFFECTS[Math.floor(rand() * JESTER_EFFECTS.length)]

export const JESTER_CAP = ['10000000001', '11000100011', '01101110110', '00111111100', '00111111100', '01111111110']

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  // Harlequin diamonds.
  for (let y = 1; y < BH - 1; y++) {
    for (let x = 1; x < BW - 1; x++) {
      const odd = (Math.floor((x + y) / 8) + Math.floor((x - y + 800) / 8)) % 2
      fill(ctx, odd ? RED : GOLD, x, y, 1, 1)
    }
  }
  panel(ctx, OUTLINE, 6, 6, BW - 12, BH - 12, 2)
  panel(ctx, PURPLE, 7, 7, BW - 14, BH - 14, 1)

  panel(ctx, OUTLINE, 12, 10, BW - 24, 13, 2)
  panel(ctx, GOLD, 13, 11, BW - 26, 11, 1)
  const name = values.name ?? ''
  const s = fitScale(name, BW - 32, 2)
  drawTextCentered(ctx, name, BW / 2, s === 2 ? 12 : 14, OUTLINE, s)

  // Jester cap with bells.
  drawBitmap(ctx, JESTER_CAP, BW / 2 - 5, 24, RED)
  fill(ctx, GOLD, BW / 2 - 6, 23, 2, 2)
  fill(ctx, GOLD, BW / 2 + 5, 23, 2, 2)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  panel(ctx, OUTLINE, 10, 94, BW - 20, 26, 2)
  panel(ctx, CREAM, 11, 95, BW - 22, 24, 1)
  const lines = wrapText(values.effect ?? '', EFFECT_WIDTH, 2)
  const top = lines.length === 1 ? 103 : 99
  lines.forEach((line, i) => drawTextCentered(ctx, line, BW / 2, top + i * 8, OUTLINE))
}

export const jester: Template = {
  id: 'jester',
  name: 'Jester Card',
  description: 'Harlequin card · a random silly effect',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 63, h: Math.round(((63 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'name', label: 'Name', default: 'JESTER', maxLength: 12 },
    { key: 'effect', label: 'Effect', default: () => randomJesterEffect(), maxLength: 36, perCapture: true },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
