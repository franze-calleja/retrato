import { diag, fract, hsl, overlay, step } from './effects'
import type { Edition } from './types'

export const holo: Edition = {
  id: 'holo',
  name: 'Holographic',
  defaultWeight: 12,
  badge: '★ HOLO',
  rare: true,
  hasEffect: true,
  overlay(w, h, angle) {
    return overlay(w, h, (x, y) => {
      const [r, g, b] = hsl(step(fract(diag(x, y, w, h) * 2.5 + angle), 6), 0.9, 0.6)
      return [r, g, b, 0.32]
    })
  },
}
