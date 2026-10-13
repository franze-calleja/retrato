import { diag, overlay, step } from './effects'
import type { Edition } from './types'

const BAND = 0.14

export const foil: Edition = {
  id: 'foil',
  name: 'Foil',
  defaultWeight: 25,
  badge: '★ FOIL',
  rare: false,
  hasEffect: true,
  overlay(w, h, angle) {
    const center = angle * 1.6 - 0.3
    return overlay(w, h, (x, y) => {
      const t = 1 - Math.abs(diag(x, y, w, h) - center) / BAND
      return t > 0 ? [255, 255, 255, step(t, 3) * 0.6] : [215, 222, 235, 0.08]
    })
  },
}
