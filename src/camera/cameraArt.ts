import {
  COPPER, COPPER_DARK, CREAM, LEATHER, LEATHER_DARK, LENS_DARK, NAVY_DARK, OUTLINE, RED, SHADOW,
  SILVER, SILVER_DARK, SILVER_LIGHT,
} from '../templates/colors'
import { fill, panel, withDropShadow } from '../templates/draw'
import { drawText } from '../templates/pixelFont'
import { fillShape, grow } from '../templates/shapes'
import type { Rect } from '../templates/types'

// Original pixel camera inspired by retro hybrid instant cameras: no real brand marks.

export type CameraSide = 'front' | 'back'

export const CAMERA_ART = { w: 128, h: 88 }
const SHADOW_OFFSET = 3
export const CAMERA_SIZE = { w: CAMERA_ART.w + SHADOW_OFFSET, h: CAMERA_ART.h + SHADOW_OFFSET }

export const SHUTTER: Rect = { x: 77, y: 3, w: 15, h: 15 }
export const FLASH: Rect = { x: 98, y: 4, w: 26, h: 14 }
export const REAR_SCREEN: Rect = { x: 10, y: 12, w: 70, h: 56 }
/** Print slot on the left edge of the front; the same slot seen from the back is on the right edge. */
export const PRINT_SLOT: Rect = { x: 1, y: 28, w: 2, h: 40 }
export const PRINT_SLOT_BACK: Rect = { x: CAMERA_ART.w - 3, y: PRINT_SLOT.y, w: 2, h: PRINT_SLOT.h }
const LEATHER_RECT: Rect = { x: 6, y: 22, w: 116, h: 58 }
const LENS: Rect = { x: 40, y: 27, w: 48, h: 48 }

const hash = (x: number, y: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return n - Math.floor(n)
}

function body(ctx: CanvasRenderingContext2D) {
  const { w, h } = CAMERA_ART
  panel(ctx, OUTLINE, 0, 0, w, h, 4)
  panel(ctx, SILVER, 1, 1, w - 2, h - 2, 3)
  fill(ctx, SILVER_LIGHT, 4, 2, w - 8, 1)
  fill(ctx, SILVER_DARK, 4, h - 3, w - 8, 1)
}

function leather(ctx: CanvasRenderingContext2D, r: Rect) {
  panel(ctx, OUTLINE, r.x, r.y, r.w, r.h, 2)
  panel(ctx, LEATHER, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 1)
  for (let y = r.y + 2; y < r.y + r.h - 2; y++)
    for (let x = r.x + 2; x < r.x + r.w - 2; x++) if (hash(x, y) < 0.18) fill(ctx, LEATHER_DARK, x, y, 1, 1)
}

function ring(ctx: CanvasRenderingContext2D, r: Rect, colors: Parameters<typeof fill>[1][]) {
  colors.forEach((c, i) => fillShape(ctx, c, grow(r, -i), 'circle'))
}

function slot(ctx: CanvasRenderingContext2D, r: Rect, darkX: number, lightX: number) {
  fill(ctx, OUTLINE, darkX, r.y, 1, r.h)
  fill(ctx, SILVER_LIGHT, lightX, r.y, 1, r.h)
}

export function drawCameraFront(ctx: CanvasRenderingContext2D) {
  body(ctx)
  slot(ctx, PRINT_SLOT, PRINT_SLOT.x + 1, PRINT_SLOT.x + 2)
  drawText(ctx, 'RETRATO', 8, 8, OUTLINE)
  // Viewfinder window.
  panel(ctx, OUTLINE, 54, 5, 16, 12, 1)
  fill(ctx, SILVER_LIGHT, 55, 6, 14, 10)
  fill(ctx, SILVER_DARK, 55, 15, 14, 1)
  // Shutter button.
  ring(ctx, SHUTTER, [OUTLINE, SILVER_DARK, SILVER, SILVER, SILVER_LIGHT])
  fill(ctx, CREAM, SHUTTER.x + 5, SHUTTER.y + 4, 2, 1)
  // Flash with its red light.
  panel(ctx, OUTLINE, FLASH.x, FLASH.y, FLASH.w, FLASH.h, 2)
  panel(ctx, NAVY_DARK, FLASH.x + 1, FLASH.y + 1, FLASH.w - 2, FLASH.h - 2, 1)
  fill(ctx, RED, FLASH.x + 3, FLASH.y + 3, 3, 8)
  fill(ctx, CREAM, FLASH.x + 8, FLASH.y + 2, 16, 10)
  for (let x = FLASH.x + 10; x < FLASH.x + 23; x += 3) fill(ctx, SILVER_LIGHT, x, FLASH.y + 3, 1, 8)
  leather(ctx, LEATHER_RECT)
  // Lens: silver ring, dark barrel, glass with a highlight.
  ring(ctx, LENS, [OUTLINE, SILVER_LIGHT, SILVER, SILVER, SILVER_DARK, OUTLINE, LENS_DARK, LENS_DARK, LENS_DARK])
  ring(ctx, grow(LENS, -11), [OUTLINE, NAVY_DARK, NAVY_DARK, LENS_DARK])
  ring(ctx, grow(LENS, -17), [OUTLINE, NAVY_DARK])
  fill(ctx, CREAM, LENS.x + 17, LENS.y + 16, 2, 2)
  fill(ctx, SILVER_LIGHT, LENS.x + 20, LENS.y + 15, 1, 1)
  // Copper power dial.
  ring(ctx, { x: 9, y: 63, w: 15, h: 15 }, [OUTLINE, COPPER_DARK, COPPER, COPPER])
  fill(ctx, COPPER_DARK, 16, 66, 1, 6)
}

export function drawCameraBack(ctx: CanvasRenderingContext2D) {
  body(ctx)
  slot(ctx, PRINT_SLOT_BACK, PRINT_SLOT_BACK.x, PRINT_SLOT_BACK.x - 1)
  const s = REAR_SCREEN
  panel(ctx, OUTLINE, s.x - 2, s.y - 2, s.w + 4, s.h + 4, 2)
  fill(ctx, NAVY_DARK, s.x, s.y, s.w, s.h)
  // Two dials and a 4-way pad.
  ring(ctx, { x: 92, y: 14, w: 17, h: 17 }, [OUTLINE, SILVER_DARK, SILVER, SILVER_LIGHT])
  ring(ctx, { x: 92, y: 36, w: 17, h: 17 }, [OUTLINE, SILVER_DARK, SILVER, SILVER_LIGHT])
  fill(ctx, OUTLINE, 99, 58, 3, 13)
  fill(ctx, OUTLINE, 94, 63, 13, 3)
  fill(ctx, SILVER_DARK, 100, 59, 1, 11)
  fill(ctx, SILVER_DARK, 95, 64, 11, 1)
  leather(ctx, { x: 6, y: 74, w: 116, h: 10 })
}

const cache = new Map<CameraSide, HTMLCanvasElement>()
/** Tests only: forget the drawn art so it is drawn again. */
export const __resetCameraArtCache = () => cache.clear()

function art(side: CameraSide) {
  let c = cache.get(side)
  if (!c) {
    c = document.createElement('canvas')
    c.width = CAMERA_SIZE.w
    c.height = CAMERA_SIZE.h
    withDropShadow(c.getContext('2d')!, CAMERA_ART.w, CAMERA_ART.h, SHADOW_OFFSET, SHADOW, side === 'front' ? drawCameraFront : drawCameraBack)
    cache.set(side, c)
  }
  return c
}

export function cameraArt(side: CameraSide, scale: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const out = target ?? document.createElement('canvas')
  out.width = CAMERA_SIZE.w * scale
  out.height = CAMERA_SIZE.h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(art(side), 0, 0, out.width, out.height)
  return out
}
