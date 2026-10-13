import type { Edition } from './types'

export const common: Edition = {
  id: 'common',
  name: 'Common',
  defaultWeight: 60,
  rare: false,
  hasEffect: false,
  overlay: () => null,
}
