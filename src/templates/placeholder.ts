import type { PhotoSource } from '../photo/crop'
import { BLUE, GOLD, OUTLINE, RED } from './colors'
import { css } from './draw'
import type { Template } from './types'

const SCALE = 4

export function placeholderPhoto(t: Template): PhotoSource {
  const w = t.photoRect.w * SCALE
  const h = t.photoRect.h * SCALE
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, css(BLUE))
  bg.addColorStop(1, css(RED))
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const r = Math.min(w, h) * 0.32
  const cx = w / 2
  const cy = h / 2
  ctx.fillStyle = css(GOLD)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = css(OUTLINE)
  for (const ex of [cx - r * 0.38, cx + r * 0.38]) {
    ctx.beginPath()
    ctx.arc(ex, cy - r * 0.22, r * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = css(OUTLINE)
  ctx.lineWidth = r * 0.1
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy + r * 0.05, r * 0.5, Math.PI * 0.2, Math.PI * 0.8)
  ctx.stroke()

  return { source: canvas, w, h }
}
