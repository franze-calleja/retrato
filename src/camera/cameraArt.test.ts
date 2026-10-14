import { expect, test, vi } from 'vitest'

const texts = vi.hoisted(() => [] as string[])
vi.mock('../templates/pixelFont', async (orig) => {
  const mod = await orig<typeof import('../templates/pixelFont')>()
  return {
    ...mod,
    drawText: (...a: Parameters<typeof mod.drawText>) => (texts.push(a[1]), mod.drawText(...a)),
    drawTextCentered: (...a: Parameters<typeof mod.drawTextCentered>) => (texts.push(a[1]), mod.drawTextCentered(...a)),
  }
})
const { CAMERA_ART, CAMERA_SIZE, FLASH, REAR_SCREEN, SHUTTER, __resetCameraArtCache, cameraArt } = await import('./cameraArt')

const inside = (r: { x: number; y: number; w: number; h: number }) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= CAMERA_ART.w && r.y + r.h <= CAMERA_ART.h

test('art is the camera size times the scale, for both sides', () => {
  for (const side of ['front', 'back'] as const) {
    const c = cameraArt(side, 3)
    expect([c.width, c.height]).toEqual([CAMERA_SIZE.w * 3, CAMERA_SIZE.h * 3])
  }
})

test('draws into a given canvas', () => {
  const target = document.createElement('canvas')
  expect(cameraArt('front', 2, target)).toBe(target)
})

test('shutter, flash and rear screen sit inside the body', () => {
  for (const r of [SHUTTER, FLASH, REAR_SCREEN]) expect(inside(r)).toBe(true)
})

test('the only lettering on the camera is PIXEL BOOTH', () => {
  __resetCameraArtCache()
  texts.length = 0
  cameraArt('front', 1, document.createElement('canvas'))
  cameraArt('back', 1, document.createElement('canvas'))
  expect(new Set(texts.filter(Boolean))).toEqual(new Set(['PIXEL BOOTH']))
})

test('the print slot is on the left edge of the front and the right edge of the back', async () => {
  const { PRINT_SLOT, PRINT_SLOT_BACK } = await import('./cameraArt')
  expect(PRINT_SLOT.x).toBeLessThanOrEqual(3)
  expect(PRINT_SLOT.h).toBeGreaterThan(PRINT_SLOT.w * 10)
  expect(PRINT_SLOT_BACK.x + PRINT_SLOT_BACK.w).toBeGreaterThanOrEqual(CAMERA_ART.w - 3)
  expect(PRINT_SLOT_BACK.y).toBe(PRINT_SLOT.y)
  for (const r of [PRINT_SLOT, PRINT_SLOT_BACK]) expect(inside(r)).toBe(true)
})
