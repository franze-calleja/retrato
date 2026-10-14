import { expect, test } from 'vitest'
import { capturePackPhoto, packCaptureSize } from './capture'

test('scales the longest side down to 1600 and keeps the aspect', () => {
  expect(packCaptureSize(1920, 1080)).toEqual({ w: 1600, h: 900 })
  expect(packCaptureSize(1080, 1920)).toEqual({ w: 900, h: 1600 })
})

test('never upscales small photos', () => {
  expect(packCaptureSize(640, 480)).toEqual({ w: 640, h: 480 })
})

test('rounds to whole pixels and never returns 0', () => {
  expect(packCaptureSize(4000, 1)).toEqual({ w: 1600, h: 1 })
})

test('capturePackPhoto bakes the mirror into an unmirrored canvas of that size', () => {
  const out = capturePackPhoto({ source: document.createElement('canvas'), w: 1920, h: 1080, mirror: true })
  expect([out.w, out.h, out.mirror]).toEqual([1600, 900, undefined])
  const c = out.source as HTMLCanvasElement
  expect([c.width, c.height]).toEqual([1600, 900])
})
