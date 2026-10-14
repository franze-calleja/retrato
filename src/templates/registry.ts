import { idcard } from './idcard'
import { jester } from './jester'
import { planet } from './planet'
import { stamp } from './stamp'
import { tarot } from './tarot'
import { ticket } from './ticket'
import { trading } from './trading'
import type { Template } from './types'
import { voucher } from './voucher'

export const templates: readonly Template[] = [stamp, voucher, ticket, trading, idcard, tarot, planet, jester]

export function getTemplate(id: string): Template {
  const t = templates.find((t) => t.id === id)
  if (!t) throw new Error(`Unknown template: ${id}`)
  return t
}
