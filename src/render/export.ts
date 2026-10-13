export const PREVIEW_SCALE = 4
export const EXPORT_SCALE = 8

export function exportFileName(templateId: string, now = new Date()): string {
  return `pixel-booth-${templateId}-${now.toISOString().replace(/[:.]/g, '-')}.png`
}
