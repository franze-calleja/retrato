import { BLUE, BLUE_DARK, CREAM, GOLD, NAVY_DARK, OUTLINE, SHADOW } from './colors'
import { fill, panel, withDropShadow } from './draw'
import { drawTextCentered, fitScale } from './pixelFont'
import { fillShape, grow } from './shapes'
import type { Template } from './types'

const BW = 96
const BH = 132
const SHADOW_OFFSET = 3
const PHOTO = { x: 18, y: 16, w: 60, h: 60 }

export const PLANETS = ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO']
export const COSMIC_LINES = [
  '+3 GRAVITAS', 'LVL 7 SHINE', '+5 ORBIT', 'X2 STARDUST', '+1 MOON', 'LVL 9 GLOW', '+4 COSMIC VIBES', 'RINGS +2',
]

const pick = (list: readonly string[], rand: () => number) => list[Math.floor(rand() * list.length)]
export const randomPlanet = (rand: () => number = Math.random) => pick(PLANETS, rand)
export const randomCosmicLine = (rand: () => number = Math.random) => pick(COSMIC_LINES, rand)

const hash = (x: number, y: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return v - Math.floor(v)
}

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, NAVY_DARK, 1, 1, BW - 2, BH - 2, 2)

  // Fixed starfield.
  for (let y = 3; y < BH - 3; y++) {
    for (let x = 3; x < BW - 3; x++) {
      const n = hash(x, y)
      if (n > 0.995) fill(ctx, GOLD, x, y, 1, 1)
      else if (n > 0.975) fill(ctx, CREAM, x, y, 1, 1)
    }
  }

  // Orbit ring passing behind the porthole.
  const cx = PHOTO.x + PHOTO.w / 2
  const cy = PHOTO.y + PHOTO.h / 2
  for (let a = 0; a < 360; a += 1) {
    const t = (a * Math.PI) / 180
    fill(ctx, BLUE, Math.round(cx + 44 * Math.cos(t)), Math.round(cy + 13 * Math.sin(t)), 1, 1)
  }

  // Round porthole: gold mat, dark rim; the composer clips the photo to the same circle.
  fillShape(ctx, GOLD, grow(PHOTO, 3), 'circle')
  fillShape(ctx, OUTLINE, grow(PHOTO, 1), 'circle')

  const planet = values.planet ?? ''
  const s = fitScale(planet, BW - 12, 2)
  drawTextCentered(ctx, planet, BW / 2, s === 2 ? 86 : 89, CREAM, s, BLUE_DARK)

  panel(ctx, OUTLINE, 8, 102, BW - 16, 14, 2)
  panel(ctx, BLUE, 9, 103, BW - 18, 12, 1)
  drawTextCentered(ctx, values.effect ?? '', BW / 2, 107, CREAM, 1, BLUE_DARK)
  drawTextCentered(ctx, 'PIXEL COSMOS', BW / 2, 121, GOLD)
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
