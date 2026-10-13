import { stamp } from './stamp'
import { ticket } from './ticket'
import type { Template } from './types'
import { voucher } from './voucher'

export const templates: readonly Template[] = [stamp, voucher, ticket]

export function getTemplate(id: string): Template {
  const t = templates.find((t) => t.id === id)
  if (!t) throw new Error(`Unknown template: ${id}`)
  return t
}
