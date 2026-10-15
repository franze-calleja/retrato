import type { Template, TemplateVariant } from './types'

// One resolved template per template object and variant object, so identities stay stable between frames.
const memo = new WeakMap<Template, { variant: TemplateVariant; template: Template }>()

export function resolveTemplate(t: Template, values: Record<string, string>): Template {
  if (!t.variant) return t
  const variant = t.variant(values)
  const hit = memo.get(t)
  if (hit?.variant === variant) return hit.template
  const template = { ...t, ...variant }
  memo.set(t, { variant, template })
  return template
}
