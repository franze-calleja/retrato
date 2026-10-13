const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v))

/** Rotation (degrees) that tilts a card toward the pointer, clamped to ±max. */
export function tiltFor(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  max: number,
) {
  const px = clamp((clientX - rect.left) / rect.width - 0.5)
  const py = clamp((clientY - rect.top) / rect.height - 0.5)
  // `+ 0` normalizes -0 to 0.
  return { rx: -py * 2 * max + 0, ry: px * 2 * max + 0 }
}
