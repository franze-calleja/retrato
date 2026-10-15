import { BLUE, CARD_WHITE, CREAM, CREAM_DARK, GOLD, NAVY, OUTLINE, PINK, PURPLE, RED, RED_DARK, SHADOW } from './colors'
import { dither, drawTextVertical } from './detail'
import { css, fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered, wrapText } from './pixelFont'
import { drawTitle } from './pixelFontLarge'
import type { BadgeAnchor } from '../editions/apply'
import type { Template, TemplateVariant } from './types'

const BW = 96
const BH = 132
const SHADOW_OFFSET = 3
const CLASSIC_PHOTO = { x: 18, y: 16, w: 60, h: 64 }
const FULL_PHOTO = { x: 4, y: 4, w: 88, h: 124 }
const THEME = { x: 10, y: 8, w: 76, h: 80 }
const BANNER = { x: 6, y: 100, w: 76, h: 24 }
const BADGE_TR: BadgeAnchor = { x: BW - 1, y: 0, align: 'right' }

export const JOKER_EFFECTS = [
  'DOUBLES ALL SNACKS', '+10 DANCE MOVES', 'RETRIGGERS LAUGHTER', '+4 TO VIBES', 'X2 CHAOS ON FRIDAYS',
  'ALL SMILES SCORE TWICE', 'COPIES THE BEST POSE', '+1 HIGH FIVE PER ROUND', 'TURNS FROWNS UPSIDE DOWN',
]
export const randomJokerEffect = (rand: () => number = Math.random) => JOKER_EFFECTS[Math.floor(rand() * JOKER_EFFECTS.length)]

export const JOKER_LAYOUTS = [
  { value: 'sunburst', label: 'Sunburst' },
  { value: 'stripes', label: 'Stripes' },
  { value: 'stars', label: 'Starfield' },
  { value: 'halftone', label: 'Halftone' },
  { value: 'fullart', label: 'Full art' },
] as const
type Layout = (typeof JOKER_LAYOUTS)[number]['value']
type Classic = Exclude<Layout, 'fullart'>
const CLASSIC: readonly Classic[] = ['sunburst', 'stripes', 'stars', 'halftone']

export function rollJokerLayout(rand: () => number = Math.random): Layout {
  const r = rand()
  if (r < 0.25) return 'fullart'
  return CLASSIC[Math.min(CLASSIC.length - 1, Math.floor(((r - 0.25) / 0.75) * CLASSIC.length))]
}

const layoutOf = (v?: string): Layout => (JOKER_LAYOUTS.some((l) => l.value === v) ? (v as Layout) : 'sunburst')

/** Playing-card corner index: top-left reads down; bottom-right is the same turned 180°. */
function indices(ctx: CanvasRenderingContext2D, tl: { x: number; y: number }, br: { x: number; y: number }) {
  drawTextVertical(ctx, 'JOKER', tl.x, tl.y, RED, 'small', undefined, 'down')
  drawTextVertical(ctx, 'JOKER', br.x, br.y, RED, 'small', undefined, 'up')
}

function theme(ctx: CanvasRenderingContext2D, layout: Classic) {
  const r = THEME
  outline(ctx, OUTLINE, r.x - 1, r.y - 1, r.w + 2, r.h + 2)
  if (layout === 'sunburst') {
    fill(ctx, GOLD, r.x, r.y, r.w, r.h)
    ctx.fillStyle = css(RED)
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const sector = Math.floor(((Math.atan2(y + 0.5 - cy, x + 0.5 - cx) + Math.PI) / (2 * Math.PI)) * 16)
        if (sector % 2 === 0) ctx.fillRect(x, y, 1, 1)
      }
  } else if (layout === 'stripes') {
    fill(ctx, CREAM, r.x, r.y, r.w, r.h)
    ctx.fillStyle = css(BLUE)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) if (Math.floor((x + y) / 4) % 2 === 0) ctx.fillRect(x, y, 1, 1)
  } else if (layout === 'stars') {
    fill(ctx, NAVY, r.x, r.y, r.w, r.h)
    dither(ctx, r, CREAM, 0.03, 21)
    dither(ctx, r, GOLD, 0.012, 22)
  } else {
    fill(ctx, PURPLE, r.x, r.y, r.w, r.h)
    ctx.fillStyle = css(PINK)
    for (let y = r.y + 1; y < r.y + r.h; y += 4)
      for (let x = r.x + 1; x < r.x + r.w; x += 4) {
        const s = 1 + Math.floor(((y - r.y) / r.h) * 3)
        ctx.fillRect(x, y, Math.min(s, r.x + r.w - x), Math.min(s, r.y + r.h - y))
      }
  }
}

function classicBody(ctx: CanvasRenderingContext2D, values: Record<string, string>, layout: Classic) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, CARD_WHITE, 1, 1, BW - 2, BH - 2, 2)
  outline(ctx, CREAM_DARK, 2, 2, BW - 4, BH - 4)
  theme(ctx, layout)
  const P = CLASSIC_PHOTO
  panel(ctx, CREAM, P.x - 3, P.y - 3, P.w + 6, P.h + 6, 1)
  outline(ctx, OUTLINE, P.x - 1, P.y - 1, P.w + 2, P.h + 2)
  indices(ctx, { x: 8, y: 5 }, { x: 88, y: BH - 5 })

  panel(ctx, OUTLINE, 10, 91, BW - 20, 14, 2)
  panel(ctx, GOLD, 11, 92, BW - 22, 12, 1)
  drawTitle(ctx, values.name ?? '', BW / 2, 91, 70, OUTLINE, undefined, 1)
  wrapText(values.effect ?? '', 72, 2).forEach((line, i) => drawTextCentered(ctx, line, BW / 2, 109 + i * 8, OUTLINE))
}

function fullBody(ctx: CanvasRenderingContext2D) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, CARD_WHITE, 1, 1, BW - 2, BH - 2, 2)
  outline(ctx, OUTLINE, FULL_PHOTO.x - 1, FULL_PHOTO.y - 1, FULL_PHOTO.w + 2, FULL_PHOTO.h + 2)
}

function fullOverlay(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 2, 2, 10, 25, 2)
  panel(ctx, CARD_WHITE, 3, 3, 8, 23, 1)
  panel(ctx, OUTLINE, BW - 12, BH - 27, 10, 25, 2)
  panel(ctx, CARD_WHITE, BW - 11, BH - 26, 8, 23, 1)
  indices(ctx, { x: 10, y: 5 }, { x: BW - 10, y: BH - 5 })

  const B = BANNER
  panel(ctx, OUTLINE, B.x, B.y, B.w, B.h, 2)
  panel(ctx, CARD_WHITE, B.x + 1, B.y + 1, B.w - 2, B.h - 2, 1)
  const cx = B.x + B.w / 2
  drawTitle(ctx, values.name ?? '', cx, B.y, B.w - 6, OUTLINE, undefined, 1)
  // Two short lines fit under the name, like the classic layout (no mid-word cuts).
  wrapText(values.effect ?? '', B.w - 6, 2).forEach((line, i) => drawTextCentered(ctx, line, cx, B.y + 12 + i * 6, RED_DARK))
}

const shadowed = (draw: (c: CanvasRenderingContext2D) => void) => (ctx: CanvasRenderingContext2D) =>
  withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, draw)

const VARIANTS: Record<Layout, TemplateVariant> = {
  sunburst: { photoRect: CLASSIC_PHOTO, badgeAt: BADGE_TR, render: (ctx, v) => shadowed((c) => classicBody(c, v, 'sunburst'))(ctx) },
  stripes: { photoRect: CLASSIC_PHOTO, badgeAt: BADGE_TR, render: (ctx, v) => shadowed((c) => classicBody(c, v, 'stripes'))(ctx) },
  stars: { photoRect: CLASSIC_PHOTO, badgeAt: BADGE_TR, render: (ctx, v) => shadowed((c) => classicBody(c, v, 'stars'))(ctx) },
  halftone: { photoRect: CLASSIC_PHOTO, badgeAt: BADGE_TR, render: (ctx, v) => shadowed((c) => classicBody(c, v, 'halftone'))(ctx) },
  fullart: { photoRect: FULL_PHOTO, badgeAt: BADGE_TR, render: (ctx) => shadowed(fullBody)(ctx), overlay: fullOverlay },
}

export const jester: Template = {
  id: 'jester',
  name: 'Joker Card',
  description: 'Playing-card joker · a random silly effect',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: CLASSIC_PHOTO,
  badgeAt: BADGE_TR,
  printSizeMm: { w: 63, h: Math.round(((63 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'name', label: 'Name', default: 'JOKER', maxLength: 12 },
    { key: 'effect', label: 'Effect', default: () => randomJokerEffect(), maxLength: 36, perCapture: true },
    { key: 'layout', label: 'Layout', default: () => rollJokerLayout(), maxLength: Math.max(...JOKER_LAYOUTS.map((o) => o.value.length)), perCapture: true, options: JOKER_LAYOUTS },
  ],
  variant: (values) => VARIANTS[layoutOf(values.layout)],
  render(ctx, values) {
    VARIANTS[layoutOf(values.layout)].render!(ctx, values)
  },
}
