export interface PhotoSource {
  source: CanvasImageSource
  w: number
  h: number
  /** Flip horizontally when drawn (live selfie camera). */
  mirror?: boolean
}

/** Largest centered source region with the target's aspect ratio. */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  const dstAspect = dstW / dstH
  if (srcW / srcH > dstAspect) {
    const sw = srcH * dstAspect
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH }
  }
  const sh = srcW / dstAspect
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh }
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  photo: PhotoSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const { sx, sy, sw, sh } = coverCrop(photo.w, photo.h, dw, dh)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (photo.mirror) {
    ctx.translate(dx * 2 + dw, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(photo.source, sx, sy, sw, sh, dx, dy, dw, dh)
  ctx.restore()
}

export function cropPhoto(photo: PhotoSource, width: number, height: number): PhotoSource {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  drawCover(canvas.getContext('2d')!, photo, 0, 0, width, height)
  return { source: canvas, w: width, h: height }
}
