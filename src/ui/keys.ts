export const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Alt', 'Control', 'Meta', 'CapsLock', 'Escape'])

/** A deliberate key press on the page: not Tab, a lone modifier, a shortcut, a held key, or typing in a field. */
export function isAdvanceKey(e: KeyboardEvent): boolean {
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || IGNORED_KEYS.has(e.key)) return false
  const t = e.target
  return !(t instanceof Element && t.closest('input, textarea, select, [role="dialog"]'))
}
