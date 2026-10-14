/** Cmd/Ctrl+P with no other modifiers, not a key repeat, and no modal dialog (operator panel) open. */
export function isPrintShortcut(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.repeat) return false
  if (e.key.toLowerCase() !== 'p' && e.code !== 'KeyP') return false
  return !document.querySelector('[aria-modal="true"]')
}
