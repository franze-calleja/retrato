export type Color = readonly [number, number, number] | readonly [number, number, number, number]

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const css = (c: Color) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] ?? 1})`

export function fill(ctx: CanvasRenderingContext2D, color: Color, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = css(color)
  ctx.fillRect(x, y, w, h)
}

export function outline(ctx: CanvasRenderingContext2D, color: Color, x: number, y: number, w: number, h: number) {
  fill(ctx, color, x, y, w, 1)
  fill(ctx, color, x, y + h - 1, w, 1)
  fill(ctx, color, x, y, 1, h)
  fill(ctx, color, x + w - 1, y, 1, h)
}

/** Filled rectangle with stepped ("pixel rounded") corners. */
export function panel(ctx: CanvasRenderingContext2D, color: Color, x: number, y: number, w: number, h: number, r = 2) {
  fill(ctx, color, x, y + r, w, h - 2 * r)
  for (let i = 0; i < r; i++) {
    const inset = r - i
    fill(ctx, color, x + inset, y + i, w - 2 * inset, 1)
    fill(ctx, color, x + inset, y + h - 1 - i, w - 2 * inset, 1)
  }
}

export function drawBitmap(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  color: Color,
  scale = 1,
) {
  ctx.fillStyle = css(color)
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === '1') ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale)
    }
  })
}

/** Draws `drawBody` with a solid offset drop shadow matching its exact silhouette (notches included). */
export function withDropShadow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  offset: number,
  color: Color,
  drawBody: (ctx: CanvasRenderingContext2D) => void,
) {
  const body = document.createElement('canvas')
  body.width = w
  body.height = h
  drawBody(body.getContext('2d')!)

  const shadow = document.createElement('canvas')
  shadow.width = w
  shadow.height = h
  const sctx = shadow.getContext('2d')!
  sctx.drawImage(body, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = css(color)
  sctx.fillRect(0, 0, w, h)

  ctx.drawImage(shadow, offset, offset)
  ctx.drawImage(body, 0, 0)
}
