export interface Edition {
  id: string
  name: string
  defaultWeight: number
  /** Pixel sticker text drawn on the frame; none for common. */
  badge?: string
  /** Rare editions get the banner + sparkle reveal. */
  rare: boolean
  /** False when overlay() always returns null (no shimmer to animate). */
  hasEffect: boolean
  /** Art-resolution RGBA overlay for a shimmer angle in [0, 1); applied to frame pixels only. */
  overlay(w: number, h: number, angle: number): ImageData | null
}
