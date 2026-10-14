import { cropPhoto, type PhotoSource } from '../photo/crop'

export const PACK_CAPTURE_MAX = 1600

export function packCaptureSize(w: number, h: number, max = PACK_CAPTURE_MAX) {
  const s = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}

/** Keeps the whole frame (same aspect, so nothing is cropped) so each dealt card can crop it its own way. */
export function capturePackPhoto(photo: PhotoSource): PhotoSource {
  const { w, h } = packCaptureSize(photo.w, photo.h)
  return cropPhoto(photo, w, h)
}
