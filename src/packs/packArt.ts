import { CREAM, GOLD, OUTLINE, SHADOW } from '../templates/colors'
import { drawBitmap, fill, panel, withDropShadow } from '../templates/draw'
import { drawTextCentered } from '../templates/pixelFont'
import type { PackDef } from './catalog'

const W = 64
const H = 88
const SHADOW_OFFSET = 3
export const PACK_ART_SIZE = { w: W + SHADOW_OFFSET, h: H + SHADOW_OFFSET }

function wrapper(ctx: CanvasRenderingContext2D, pack: PackDef) {
  const { body, stripe, ends, emblem, emblemColor } = pack.art
  // Body between the crimped ends.
  fill(ctx, OUTLINE, 0, 4, W, H - 8)
  fill(ctx, body, 1, 9, W - 2, H - 18)
  for (let y = 9; y < H - 9; y++) {
    for (let x = 1; x < W - 1; x++) if ((x + y) % 12 < 2) fill(ctx, stripe, x, y, 1, 1)
  }
  // Crimped foil ends: a band with sawtooth edges.
  fill(ctx, ends, 1, 5, W - 2, 4)
  fill(ctx, ends, 1, H - 9, W - 2, 4)
  for (let x = 0; x < W; x += 4) {
    fill(ctx, OUTLINE, x, 0, 3, 5)
    fill(ctx, ends, x + 1, 1, 1, 4)
    fill(ctx, OUTLINE, x, H - 5, 3, 5)
    fill(ctx, ends, x + 1, H - 5, 1, 4)
  }
  // Label: the pack's first word over a big PACK.
  panel(ctx, OUTLINE, 6, 20, W - 12, 30, 2)
  panel(ctx, GOLD, 7, 21, W - 14, 28, 1)
  drawTextCentered(ctx, pack.name.split(' ')[0], W / 2, 25, OUTLINE)
  drawTextCentered(ctx, 'PACK', W / 2, 33, OUTLINE, 2)
  drawBitmap(ctx, emblem, Math.round(W / 2 - emblem[0].length / 2), 54, emblemColor)
  drawTextCentered(ctx, 'PICK 1 OF 3', W / 2, 69, CREAM, 1, stripe)
}

export function packArt(pack: PackDef, scale: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const art = document.createElement('canvas')
  art.width = PACK_ART_SIZE.w
  art.height = PACK_ART_SIZE.h
  withDropShadow(art.getContext('2d')!, W, H, SHADOW_OFFSET, SHADOW, (c) => wrapper(c, pack))
  const out = target ?? document.createElement('canvas')
  out.width = PACK_ART_SIZE.w * scale
  out.height = PACK_ART_SIZE.h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(art, 0, 0, out.width, out.height)
  return out
}

/** Art rows above this line are the crimped top strip that tears off when the pack opens. */
export const TEAR_ROW = 9

/** The pack art split into its top strip and the rest, both at `scale`; stacked they equal `packArt`. */
export function packArtParts(
  pack: PackDef,
  scale: number,
  targets: { top: HTMLCanvasElement; body: HTMLCanvasElement } = {
    top: document.createElement('canvas'),
    body: document.createElement('canvas'),
  },
) {
  const full = packArt(pack, scale)
  const split = TEAR_ROW * scale
  const parts = [
    [targets.top, 0, split],
    [targets.body, split, full.height - split],
  ] as const
  for (const [canvas, sy, h] of parts) {
    canvas.width = full.width
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(full, 0, sy, full.width, h, 0, 0, full.width, h)
  }
  return targets
}
