import type { BadgeAnchor } from '../editions/apply'
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
  /** One line for the shop's info box. */
  description: string
  /** Art pixels, including drop-shadow margin. */
  size: { w: number; h: number }
  /** Art pixels. The composer draws the photo here; render() must not. */
  photoRect: Rect
  fields: readonly TemplateField[]
  /** Where the edition badge sits (art pixels); must stay clear of photoRect. Defaults to the top-left corner. */
  badgeAt?: BadgeAnchor
  printSizeMm: { w: number; h: number }
  /** Draws frame and text at art scale. Must tolerate missing values. */
  render(ctx: CanvasRenderingContext2D, values: Record<string, string>): void
}
