import { CARD_WHITE, CREAM, SHADOW, TEAL, TEAL_DARK, TEAL_INK, TEAL_LIGHT } from './colors'
import { bevel, dither, ring } from './detail'
import { css, fill, panel, withDropShadow } from './draw'
import { drawTextCentered } from './pixelFont'
import { drawTitle } from './pixelFontLarge'
import { fillShape, grow } from './shapes'
import type { Template } from './types'

const BW = 96
const BH = 132
const SHADOW_OFFSET = 3
const PHOTO = { x: 22, y: 34, w: 52, h: 52 }

export const PLANETS = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO']
export const COSMIC_LINES = [
  '+3 GRAVITAS', 'LVL 7 SHINE', '+5 ORBIT', 'X2 STARDUST', '+1 MOON', 'LVL 9 GLOW', '+4 COSMIC VIBES', 'RINGS +2',
]

const pick = (list: readonly string[], rand: () => number) => list[Math.floor(rand() * list.length)]
export const randomPlanet = (rand: () => number = Math.random) => pick(PLANETS, rand)
export const randomCosmicLine = (rand: () => number = Math.random) => pick(COSMIC_LINES, rand)

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, TEAL_INK, 0, 0, BW, BH, 4)
  panel(ctx, TEAL, 1, 1, BW - 2, BH - 2, 3)
  bevel(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, TEAL_LIGHT, TEAL_DARK)
  dither(ctx, { x: 4, y: 4, w: BW - 8, h: BH - 8 }, TEAL_LIGHT, 0.02, 3)
  dither(ctx, { x: 4, y: 4, w: BW - 8, h: BH - 8 }, CREAM, 0.008, 4)

  // Instrument header: our own row of lights, a toggle and a level bar.
  panel(ctx, TEAL_INK, 6, 4, BW - 12, 10, 2)
  fill(ctx, TEAL_DARK, 7, 5, BW - 14, 8)
  fill(ctx, TEAL_LIGHT, 10, 8, 2, 2)
  fill(ctx, CREAM, 14, 8, 2, 2)
  panel(ctx, TEAL_LIGHT, 19, 6, 11, 5, 2)
  fill(ctx, CREAM, 25, 7, 3, 3)
  for (let i = 0; i < 5; i++) fill(ctx, i < 3 ? CREAM : TEAL_LIGHT, 35 + i * 4, 8, 2, 2)
  for (let x = 58; x < 78; x += 3) fill(ctx, TEAL_LIGHT, x, 7, 2, 4)
  ring(ctx, 84, 8, 2, CREAM)

  // Name pill.
  panel(ctx, TEAL_INK, 14, 17, 68, 13, 4)
  panel(ctx, CARD_WHITE, 15, 18, 66, 11, 3)
  drawTitle(ctx, values.planet ?? '', BW / 2, 16, 64, TEAL_INK, undefined, 1)

  // Orbit ring behind the round window.
  const cx = PHOTO.x + PHOTO.w / 2
  const cy = PHOTO.y + PHOTO.h / 2
  ctx.fillStyle = css(TEAL_LIGHT)
  for (let a = 0; a < 360; a++) {
    const t = (a * Math.PI) / 180
    ctx.fillRect(Math.round(cx + 40 * Math.cos(t)), Math.round(cy + 12 * Math.sin(t)), 1, 1)
  }
  fillShape(ctx, TEAL_LIGHT, grow(PHOTO, 3), 'circle')
  fillShape(ctx, TEAL_INK, grow(PHOTO, 1), 'circle')

  // Footer: cosmic stat, level pips, grille.
  panel(ctx, TEAL_INK, 8, 94, BW - 16, 32, 2)
  panel(ctx, TEAL_DARK, 9, 95, BW - 18, 30, 1)
  const stat = values.effect ?? ''
  drawTextCentered(ctx, stat, BW / 2, 98, CREAM)
  const digit = /\d/.exec(stat)
  const level = Math.min(5, Math.max(1, digit ? Number(digit[0]) : 3))
  for (let i = 0; i < 5; i++) {
    panel(ctx, TEAL_INK, 28 + i * 8, 106, 7, 7, 1)
    fill(ctx, i < level ? CREAM : TEAL_DARK, 29 + i * 8, 107, 5, 5)
  }
  for (let y = 117; y <= 121; y += 2) fill(ctx, TEAL_INK, 14, y, BW - 28, 1)
}

export const planet: Template = {
  id: 'planet',
  name: 'Planet Card',
  description: 'You in orbit · a planet and a cosmic stat',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  photoShape: 'circle',
  printSizeMm: { w: 63, h: Math.round(((63 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'planet', label: 'Planet', default: () => randomPlanet(), maxLength: 10, perCapture: true },
    { key: 'effect', label: 'Cosmic stat', default: () => randomCosmicLine(), maxLength: 16, perCapture: true },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
