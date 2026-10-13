import type { Template, TemplateField } from './types'

const resolve = (f: TemplateField) => (typeof f.default === 'function' ? f.default() : f.default)

export function clampValue(field: TemplateField, value: string): string {
  return Array.from(value).slice(0, field.maxLength).join('')
}

export function resolveDefaults(t: Template): Record<string, string> {
  return Object.fromEntries(t.fields.map((f) => [f.key, clampValue(f, resolve(f))]))
}

export function refreshPerCapture(t: Template, values: Record<string, string>): Record<string, string> {
  const next = { ...values }
  for (const f of t.fields) if (f.perCapture) next[f.key] = clampValue(f, resolve(f))
  return next
}
