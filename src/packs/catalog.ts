import {
  CREAM,
  GOLD,
  GOLD_DARK,
  OUTLINE,
  PURPLE,
  PURPLE_DARK,
  PURPLE_LIGHT,
  RED,
  RED_DARK,
  RED_LIGHT,
  SEPIA_DARK,
  SEPIA_INK,
  SEPIA_LIGHT,
  SEPIA_MID,
  TEAL,
  TEAL_DARK,
  TEAL_INK,
  TEAL_LIGHT,
} from '../templates/colors'
import { drawBitmap, fill, panel } from '../templates/draw'
import { fillShape } from '../templates/shapes'
import type { Color } from '../templates/draw'

export interface PackArt {
  body: Color
  stripe: Color
  ends: Color
  /** Foil highlight: crinkle streaks and crimp teeth. */
  shine: Color
  /** Pack illustration in a 32 × 19 area centred on `cx`, starting at `top`. */
  illustration(ctx: CanvasRenderingContext2D, cx: number, top: number): void
}

export interface PackDef {
  id: string
  name: string
  /** One line for the shop's info box. */
  description: string
  /** Template ids this pack deals from. One id = three different rolls of that card. */
  pool: readonly string[]
  art: PackArt
}

// Jester's cap with bells, drawn at 2× on the Joker Pack.
const JOKER_CAP = ['10000000001', '11000100011', '01101110110', '00111111100', '00111111100', '01111111110']

const card = (ctx: CanvasRenderingContext2D, x: number, y: number, pip: Color) => {
  panel(ctx, OUTLINE, x, y, 11, 15, 1)
  fill(ctx, CREAM, x + 1, y + 1, 9, 13)
  drawBitmap(ctx, ['010', '111', '010'], x + 4, y + 6, pip)
}
const fanned = (ctx: CanvasRenderingContext2D, cx: number, top: number) => {
  card(ctx, cx - 15, top + 3, RED)
  card(ctx, cx + 4, top + 3, OUTLINE)
  card(ctx, cx - 6, top, GOLD_DARK)
}
const sun = (ctx: CanvasRenderingContext2D, cx: number, top: number) => {
  const cy = top + 9
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4
    for (let r = 7; r <= 9; r++) fill(ctx, SEPIA_LIGHT, Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), 1, 1)
  }
  fillShape(ctx, SEPIA_INK, { x: cx - 6, y: cy - 6, w: 12, h: 12 }, 'circle')
  fillShape(ctx, GOLD, { x: cx - 5, y: cy - 5, w: 10, h: 10 }, 'circle')
  fill(ctx, SEPIA_DARK, cx - 2, cy - 1, 1, 1)
  fill(ctx, SEPIA_DARK, cx + 1, cy - 1, 1, 1)
  fill(ctx, SEPIA_DARK, cx - 1, cy + 2, 3, 1)
}
const ringed = (ctx: CanvasRenderingContext2D, cx: number, top: number) => {
  const cy = top + 9
  fillShape(ctx, TEAL_INK, { x: cx - 8, y: cy - 8, w: 16, h: 16 }, 'circle')
  fillShape(ctx, TEAL_LIGHT, { x: cx - 7, y: cy - 7, w: 14, h: 14 }, 'circle')
  fill(ctx, TEAL, cx - 7, cy - 1, 14, 3)
  for (let a = 0; a < 360; a += 4) {
    const t = (a * Math.PI) / 180
    const x = Math.round(cx + 14 * Math.cos(t))
    const y = Math.round(cy + 3 * Math.sin(t))
    if (Math.sin(t) > 0 || Math.abs(x - cx) > 7) fill(ctx, CREAM, x, y, 1, 1)
  }
}
const hat = (ctx: CanvasRenderingContext2D, cx: number, top: number) => {
  drawBitmap(ctx, JOKER_CAP, cx - 11, top + 4, RED, 2)
  for (const x of [cx - 13, cx + 10, cx - 2]) fill(ctx, GOLD, x, top + 2, 3, 3)
}

export const PACKS: readonly PackDef[] = [
  {
    id: 'classic',
    name: 'Classic Pack',
    description: '3 different cards from one photo, each with its own edition. Keep 1.',
    pool: ['stamp', 'voucher', 'ticket', 'trading', 'id'],
    art: { body: PURPLE, stripe: PURPLE_DARK, ends: GOLD_DARK, shine: PURPLE_LIGHT, illustration: fanned },
  },
  {
    id: 'arcana',
    name: 'Arcana Pack',
    description: '3 tarot cards, 3 different arcana. Keep 1.',
    pool: ['tarot'],
    art: { body: SEPIA_DARK, stripe: SEPIA_INK, ends: SEPIA_MID, shine: SEPIA_MID, illustration: sun },
  },
  {
    id: 'cosmic',
    name: 'Cosmic Pack',
    description: '3 planet cards from across the galaxy. Keep 1.',
    pool: ['planet'],
    art: { body: TEAL_DARK, stripe: TEAL_INK, ends: TEAL_LIGHT, shine: TEAL, illustration: ringed },
  },
  {
    id: 'jester',
    name: 'Joker Pack',
    description: '3 jokers with 3 different tricks. Keep 1.',
    pool: ['jester'],
    art: { body: RED, stripe: RED_DARK, ends: GOLD, shine: RED_LIGHT, illustration: hat },
  },
]

export function getPack(id: string | null | undefined): PackDef {
  return PACKS.find((p) => p.id === id) ?? PACKS[0]
}
