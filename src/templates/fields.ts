import type { Template, TemplateField } from './types'

const resolve = (f: TemplateField) => (typeof f.default === 'function' ? f.default() : f.default)

export function clampValue(field: TemplateField, value: string): string {
  return Array.from(value).slice(0, field.maxLength).join('')
}

/**
 * Fit an edited input value to `max` characters (code points) by dropping the overflow just before the caret:
 * the characters just typed or pasted. Typing mid-field in a full field then never pushes the last character out,
 * and replacing a selection with longer text keeps as much of it as fits.
 */
export function fitEdit(value: string, caret: number, max: number): string {
  const before = Array.from(value.slice(0, caret))
  const after = Array.from(value.slice(caret))
  const excess = before.length + after.length - max
  if (excess <= 0) return value
  return [...before.slice(0, Math.max(0, before.length - excess)), ...after].slice(0, max).join('')
}

export function resolveDefaults(t: Template): Record<string, string> {
  return Object.fromEntries(t.fields.map((f) => [f.key, clampValue(f, resolve(f))]))
}

export function refreshPerCapture(t: Template, values: Record<string, string>): Record<string, string> {
  const next = { ...values }
  for (const f of t.fields) if (f.perCapture) next[f.key] = clampValue(f, resolve(f))
  return next
}
