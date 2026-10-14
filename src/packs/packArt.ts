import { CREAM, GOLD, GOLD_DARK, OUTLINE, PURPLE, PURPLE_DARK, SHADOW } from '../templates/colors'
import { drawBitmap, fill, panel, withDropShadow } from '../templates/draw'
import { drawTextCentered } from '../templates/pixelFont'

const W = 64
const H = 88
const SHADOW_OFFSET = 3
export const PACK_ART_SIZE = { w: W + SHADOW_OFFSET, h: H + SHADOW_OFFSET }

const STAR = ['0001000', '0001000', '0011100', '1111111', '0011100', '0110110', '1100011']

function wrapper(ctx: CanvasRenderingContext2D) {
  // Body between the crimped ends.
  fill(ctx, OUTLINE, 0, 4, W, H - 8)
  fill(ctx, PURPLE, 1, 9, W - 2, H - 18)
  for (let y = 9; y < H - 9; y++) {
    for (let x = 1; x < W - 1; x++) if ((x + y) % 12 < 2) fill(ctx, PURPLE_DARK, x, y, 1, 1)
  }
  // Crimped foil ends: a gold band with sawtooth edges.
  fill(ctx, GOLD_DARK, 1, 5, W - 2, 4)
  fill(ctx, GOLD_DARK, 1, H - 9, W - 2, 4)
  for (let x = 0; x < W; x += 4) {
    fill(ctx, OUTLINE, x, 0, 3, 5)
    fill(ctx, GOLD_DARK, x + 1, 1, 1, 4)
    fill(ctx, OUTLINE, x, H - 5, 3, 5)
    fill(ctx, GOLD_DARK, x + 1, H - 5, 1, 4)
  }
  // Label.
  panel(ctx, OUTLINE, 6, 20, W - 12, 30, 2)
  panel(ctx, GOLD, 7, 21, W - 14, 28, 1)
  drawTextCentered(ctx, 'BOOSTER', W / 2, 25, OUTLINE)
  drawTextCentered(ctx, 'PACK', W / 2, 33, OUTLINE, 2)
  drawBitmap(ctx, STAR, W / 2 - 3, 55, GOLD)
  drawTextCentered(ctx, 'PICK 1 OF 3', W / 2, 69, CREAM, 1, PURPLE_DARK)
}

export function packArt(scale: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const art = document.createElement('canvas')
  art.width = PACK_ART_SIZE.w
  art.height = PACK_ART_SIZE.h
  withDropShadow(art.getContext('2d')!, W, H, SHADOW_OFFSET, SHADOW, wrapper)
  const out = target ?? document.createElement('canvas')
  out.width = PACK_ART_SIZE.w * scale
  out.height = PACK_ART_SIZE.h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(art, 0, 0, out.width, out.height)
  return out
}
