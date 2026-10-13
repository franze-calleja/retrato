import { fract } from './effects'

/** Angle used for downloads, prints, and reduced motion. */
export const SNAPSHOT_ANGLE = 0.35
const STEPS = 64
const DRIFT_MS = 20_000

export function quantizeAngle(a: number): number {
  return fract(Math.round(fract(a) * STEPS) / STEPS)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function angleFor(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): number {
  return (clamp01((clientX - rect.left) / rect.width) + clamp01((clientY - rect.top) / rect.height)) / 2
}

export function driftAngle(ms: number): number {
  return fract(SNAPSHOT_ANGLE + ms / DRIFT_MS)
}
