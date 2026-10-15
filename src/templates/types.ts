import type { BadgeAnchor } from '../editions/apply'
import type { Rect } from './draw'
import type { PhotoShape } from './shapes'

export type { Rect }

export interface FieldOption {
  value: string
  label: string
}

export interface TemplateField {
  key: string
  label: string
  /** Function form for generated values (dates, serials). */
  default: string | (() => string)
  maxLength: number
  /** Regenerate on every capture (e.g. ticket serial). */
  perCapture?: boolean
  /** Render as a select with these choices. */
  options?: readonly FieldOption[]
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
  /** Window shape the composer clips the photo to. Defaults to 'rect'. */
  photoShape?: PhotoShape
  /** Optional second spot for a small faded greyscale copy of the photo (ID-card ghost image), art pixels. */
  ghostRect?: Rect
  fields: readonly TemplateField[]
  /** Where the edition badge sits (art pixels); must stay clear of photoRect. Defaults to the top-left corner. */
  badgeAt?: BadgeAnchor
  printSizeMm: { w: number; h: number }
  /** Draws frame and text at art scale. Must tolerate missing values. */
  render(ctx: CanvasRenderingContext2D, values: Record<string, string>): void
  /**
   * Layout-dependent overrides (e.g. the Joker's layouts), chosen from the card's values. Return the same object for
   * the same layout (e.g. from a constant table): resolved templates are memoised on that identity.
   */
  variant?(values: Record<string, string>): TemplateVariant
  /** Art drawn over the photo (full-art layouts), at art scale. */
  overlay?(ctx: CanvasRenderingContext2D, values: Record<string, string>): void
}

export type TemplateVariant = Partial<Pick<Template, 'photoRect' | 'photoShape' | 'badgeAt' | 'ghostRect' | 'render' | 'overlay'>>
