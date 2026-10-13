import { stamp } from './stamp'
import type { Template } from './types'

export const templates: readonly Template[] = [stamp]

export function getTemplate(id: string): Template {
  const t = templates.find((t) => t.id === id)
  if (!t) throw new Error(`Unknown template: ${id}`)
  return t
}
