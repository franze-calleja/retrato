export const fract = (v: number) => v - Math.floor(v)
export const step = (v: number, levels: number) => Math.round(v * levels) / levels
/** 0 at the top-left corner, 1 at the bottom-right. */
export const diag = (x: number, y: number, w: number, h: number) => (x + y) / (w + h)

export function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

export function overlay(
  w: number,
  h: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number] | null,
): ImageData {
  const img = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = pixel(x, y)
      if (!c) continue
      const i = (y * w + x) * 4
      img.data[i] = c[0]
      img.data[i + 1] = c[1]
      img.data[i + 2] = c[2]
      img.data[i + 3] = Math.round(c[3] * 255)
    }
  }
  return img
}
