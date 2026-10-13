import { diag, fract, hsl, overlay, step } from './effects'
import type { Edition } from './types'

const hash = (x: number, y: number) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)

export const poly: Edition = {
  id: 'poly',
  name: 'Polychrome',
  defaultWeight: 3,
  badge: '★★ POLY',
  rare: true,
  hasEffect: true,
  overlay(w, h, angle) {
    return overlay(w, h, (x, y) => {
      const n = hash(x, y)
      if (n > 0.985 && fract(n * 7 + angle * 3) > 0.6) return [255, 255, 255, 0.95]
      const [r, g, b] = hsl(step(fract(diag(x, y, w, h) * 1.5 + (y / h) * 0.5 + angle * 1.5), 8), 1, 0.6)
      return [r, g, b, 0.45]
    })
  },
}
