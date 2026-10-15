export const PREVIEW_SCALE = 4
export const EXPORT_SCALE = 8

/** File-name word for a card: its display name without "Card" ("Joker Card" → "joker"). */
export const cardSlug = (name: string) => name.toLowerCase().replace(/\bcard\b/g, '').trim().replace(/\s+/g, '-')

export function exportFileName(templateId: string, now = new Date()): string {
  return `pixel-booth-${templateId}-${now.toISOString().replace(/[:.]/g, '-')}.png`
}
