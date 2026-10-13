import type { Rect } from './draw'

export type { Rect }

export interface TemplateField {
  key: string
  label: string
  /** Function form for generated values (dates, serials). */
  default: string | (() => string)
  maxLength: number
  /** Regenerate on every capture (e.g. ticket serial). */
  perCapture?: boolean
}

export interface Template {
  id: string
  name: string
  /** Art pixels, including drop-shadow margin. */
  size: { w: number; h: number }
  /** Art pixels. The composer draws the photo here; render() must not. */
  photoRect: Rect
  fields: readonly TemplateField[]
  printSizeMm: { w: number; h: number }
  /** Draws frame and text at art scale. Must tolerate missing values. */
  render(ctx: CanvasRenderingContext2D, values: Record<string, string>): void
}
