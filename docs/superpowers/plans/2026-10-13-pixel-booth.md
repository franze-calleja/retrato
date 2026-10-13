# Pixel Booth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static browser photobooth that turns a webcam capture (or uploaded photo) into a pixel-art stamp, voucher, or ticket you can download as PNG or print.

**Architecture:** Vite + React + TypeScript SPA, no backend. Pure pixel functions (`src/pixel`) pixelate and palette-quantize a frame; template modules (`src/templates`) draw a frame + text at "art pixel" scale using a built-in bitmap font; one composer (`src/render/composeStamp`) upscales by an integer for preview, download, and print. A Zustand store drives three screens: Picker → Booth → Editor.

**Tech Stack:** Node 24 LTS, Vite 8.3, React 19.2 (pinned `~19.2.8`; 19.3.0 is one day old), TypeScript ~6.0 (what create-vite 9 scaffolds), Zustand 5, Vitest 4.1 (5.0 is ~6 weeks old), jsdom 30, vitest-canvas-mock 1.2, @testing-library/react 16, @fontsource/press-start-2p 5.3.

**Spec:** `docs/superpowers/specs/2026-10-13-pixel-booth-design.md`

**Deviation from spec (flag to user):** Text on the canvas uses a built-in 3×5 bitmap font (`src/templates/pixelFont.ts`) instead of the web pixel font. Web fonts drawn on canvas at 5–8px are anti-aliased and must finish loading before drawing; a bitmap font is perfectly crisp, synchronous, and testable. Press Start 2P (self-hosted via @fontsource) is still used for the UI chrome.

## Global Constraints

- No network requests for photos; no storage; no analytics. Capture lives only in memory.
- Static build only (`vite build` → `dist/`); no env vars or secrets.
- All template geometry is in art pixels; scaling only via integer `scale` with `imageSmoothingEnabled = false`.
- `photoRect.w` and `photoRect.h` of every template are divisible by 12 (so pixel sizes 1–4 divide evenly).
- Pixel sizes: `1 | 2 | 3 | 4`. Preview scale: 4. Export (download/print) scale: 8.
- Download filename: `pixel-booth-<templateId>-<timestamp>.png`.
- Camera must be stopped whenever Booth unmounts, including when getUserMedia resolves after unmount.
- Lockfile committed. Don't upgrade deps beyond versions listed above.
- Commit style: Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`). No AI attribution lines.

## Review Focus

1. **Leaving Booth while the permission prompt is still open** — getUserMedia resolves after unmount; the stream must be stopped immediately (camera light off). Pinned in Task 7.
2. **Event-operator Retake** — edited fields (e.g. event name) must survive Retake and re-selecting the same template; only per-capture fields (ticket serial) regenerate. Pinned in Task 6.
3. **Portrait or odd-aspect sources** (phone in portrait, tall uploaded photo) — must cover-crop around the center, never stretch. Pinned in Task 2 (`coverCrop`).
4. **Lowercase, accents, emoji in text fields** — render uppercase; unknown characters fall back to `?`; never throw. Pinned in Task 3 and the template contract test in Task 4.
5. **Pasting over-long text** — clamped to `maxLength` by code points (emoji not split into broken halves). Pinned in Task 6.

---

## File Structure

```
pixel-booth/
  index.html                      Vite entry (title "Pixel Booth")
  vite.config.ts                  Vite + Vitest config
  src/
    main.tsx                      React root, font import, CSS import
    App.tsx                       Screen switch
    index.css                     UI styles + print styles
    test/setup.ts                 vitest-canvas-mock
    pixel/
      quantize.ts                 RGB type, nearestColor, quantize (pure, in-place)
      quantize.test.ts
      pixelate.ts                 coverCrop (pure), pixelate (canvas)
      pixelate.test.ts
    templates/
      types.ts                    Rect, TemplateField, Template
      draw.ts                     css, fill, outline, drawBitmap, drawPhoto
      pixelFont.ts                3×5 bitmap font: glyphFor, measureText, fitScale, drawText*
      pixelFont.test.ts
      fields.ts                   resolveDefaults, refreshPerCapture, clampValue
      stamp.ts / voucher.ts / ticket.ts
      ticket.test.ts              todayIso, randomSerial
      registry.ts                 templates, getTemplate, photoSize
      placeholder.ts              placeholderPhoto (picker + booth idle)
      templates.test.ts           contract test over every registered template
    render/
      composeStamp.ts             render at art scale → integer upscale
      composeStamp.test.ts
      export.ts                   PREVIEW_SCALE, EXPORT_SCALE, exportFileName
      export.test.ts
    store/
      booth.ts                    Zustand store
      booth.test.ts
    camera/
      useCamera.ts                getUserMedia hook
      useCamera.test.ts
    screens/
      TemplatePicker.tsx
      Booth.tsx
      Editor.tsx
```

---

### Task 1: Scaffold project and test harness

**Files:**
- Create: everything from create-vite `react-ts` template, then modify `package.json`, `vite.config.ts`, `index.html`, `src/App.tsx`, `src/main.tsx`, `src/index.css`
- Create: `src/test/setup.ts`, `src/smoke.test.ts` (deleted at end of task)
- Delete: `src/App.css`, `src/assets/`, `public/vite.svg` (if present)

**Interfaces:**
- Produces: `npm test` (vitest run, jsdom + canvas mock), `npm run build`, `npm run lint`.

- [ ] **Step 1: Scaffold into a temp dir and copy in** (repo already contains `docs/`)

```bash
SCR=$(mktemp -d)
cd "$SCR" && npm create vite@9.2.1 scaffold -- --template react-ts --no-interactive
cp -R "$SCR/scaffold/." /Users/franzecalleja/pixel-booth/
cd /Users/franzecalleja/pixel-booth
rm -rf src/App.css src/assets public/vite.svg
```

- [ ] **Step 2: Install pinned dependencies**

```bash
npm install
npm install react@~19.2.8 react-dom@~19.2.8 zustand@5.0.15 @fontsource/press-start-2p@5.3.0
npm install -D vitest@4.1.11 jsdom@30.1.2 vitest-canvas-mock@1.2.0 @testing-library/react@16.3.3 @testing-library/dom@10.4.2
```

- [ ] **Step 3: Add test scripts to `package.json`** — in `"scripts"` add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

and set `"name": "pixel-booth"`.

- [ ] **Step 4: Replace `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 5: Create `src/test/setup.ts`**

```ts
import 'vitest-canvas-mock'
```

- [ ] **Step 6: Minimal app shell.** `src/App.tsx`:

```tsx
export default function App() {
  return <main className="app"><h1 className="logo">PIXEL BOOTH</h1></main>
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/press-start-2p'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/index.css`: replace contents with `body { margin: 0; }` (styled in Task 8). In `index.html` set `<title>Pixel Booth</title>` and remove the vite.svg favicon `<link>`.

- [ ] **Step 7: Smoke test the harness.** `src/smoke.test.ts`:

```ts
import { expect, test } from 'vitest'

test('canvas mock and ImageData are available', () => {
  const ctx = document.createElement('canvas').getContext('2d')
  expect(ctx).not.toBeNull()
  expect(new ImageData(2, 3).data.length).toBe(24)
})
```

Run: `npm test` → Expected: 1 passed. Run: `npm run build` and `npm run lint` → Expected: both succeed.

- [ ] **Step 8: Delete smoke test and commit**

```bash
rm src/smoke.test.ts
git add -A
git commit -m "chore: scaffold vite react-ts app with vitest harness"
```

---

### Task 2: Pixel pipeline (quantize + pixelate)

**Files:**
- Create: `src/pixel/quantize.ts`, `src/pixel/quantize.test.ts`, `src/pixel/pixelate.ts`, `src/pixel/pixelate.test.ts`

**Interfaces:**
- Produces:
  - `type RGB = readonly [number, number, number]`
  - `nearestColor(r: number, g: number, b: number, palette: readonly RGB[]): RGB` — first entry wins ties
  - `quantize(data: Uint8ClampedArray, width: number, palette: readonly RGB[], dither: boolean): void` — in place, sets alpha 255
  - `coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number }`
  - `interface PixelateOptions { width: number; height: number; palette: readonly RGB[]; dither: boolean; mirror: boolean }`
  - `pixelate(source: CanvasImageSource, srcW: number, srcH: number, opts: PixelateOptions): ImageData`

- [ ] **Step 1: Write failing tests** `src/pixel/quantize.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { nearestColor, quantize, type RGB } from './quantize'

const BW: RGB[] = [[0, 0, 0], [255, 255, 255]]

function solid(w: number, h: number, [r, g, b]: RGB) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 0
  }
  return data
}

function colorsIn(data: Uint8ClampedArray) {
  const set = new Set<string>()
  for (let i = 0; i < data.length; i += 4) set.add(`${data[i]},${data[i + 1]},${data[i + 2]}`)
  return set
}

describe('nearestColor', () => {
  test('picks the closest palette entry', () => {
    expect(nearestColor(30, 20, 10, BW)).toEqual([0, 0, 0])
    expect(nearestColor(200, 220, 240, BW)).toEqual([255, 255, 255])
  })
  test('first entry wins ties', () => {
    expect(nearestColor(10, 10, 10, [[0, 0, 0], [20, 20, 20]])).toEqual([0, 0, 0])
  })
})

describe('quantize', () => {
  const palette: RGB[] = [[0, 0, 0], [255, 255, 255], [200, 40, 40]]

  test('without dither every pixel becomes a palette color and alpha is opaque', () => {
    const data = solid(8, 8, [190, 60, 50])
    quantize(data, 8, palette, false)
    expect(colorsIn(data)).toEqual(new Set(['200,40,40']))
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(255)
  })

  test('with dither output still only contains palette colors', () => {
    const data = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i * 37) % 256)
    quantize(data, 16, palette, true)
    for (const c of colorsIn(data)) {
      expect(palette.map((p) => p.join(','))).toContain(c)
    }
  })

  test('dither mixes two colors for a mid-tone; no dither gives one', () => {
    const plain = solid(8, 8, [128, 128, 128])
    quantize(plain, 8, BW, false)
    expect(colorsIn(plain).size).toBe(1)

    const dithered = solid(8, 8, [128, 128, 128])
    quantize(dithered, 8, BW, true)
    expect(colorsIn(dithered)).toEqual(new Set(['0,0,0', '255,255,255']))
  })
})
```

`src/pixel/pixelate.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { coverCrop, pixelate } from './pixelate'
import type { RGB } from './quantize'

describe('coverCrop', () => {
  test('same aspect uses the whole source', () => {
    expect(coverCrop(640, 480, 64, 48)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 480 })
  })
  test('landscape source into portrait target crops the sides, centered', () => {
    expect(coverCrop(1280, 720, 72, 84)).toEqual({ sx: 331.4285714285714, sy: 0, sw: 617.1428571428571, sh: 720 })
  })
  test('portrait source into landscape target crops top and bottom, centered', () => {
    const c = coverCrop(720, 1280, 60, 30)
    expect(c.sw).toBe(720)
    expect(c.sh).toBe(360)
    expect(c.sy).toBe(460)
    expect(c.sx).toBe(0)
  })
})

describe('pixelate', () => {
  test('returns ImageData of the requested size with only palette colors', () => {
    const src = document.createElement('canvas')
    src.width = 320
    src.height = 240
    const palette: RGB[] = [[10, 10, 10], [240, 240, 240]]
    const out = pixelate(src, 320, 240, { width: 24, height: 28, palette, dither: true, mirror: true })
    expect(out.width).toBe(24)
    expect(out.height).toBe(28)
    for (let i = 0; i < out.data.length; i += 4) {
      const c = `${out.data[i]},${out.data[i + 1]},${out.data[i + 2]}`
      expect(['10,10,10', '240,240,240']).toContain(c)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pixel` → Expected: FAIL, cannot resolve `./quantize` / `./pixelate`.

- [ ] **Step 3: Implement `src/pixel/quantize.ts`**

```ts
export type RGB = readonly [number, number, number]

// 4×4 ordered (Bayer) dither matrix, values 0–15.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const DITHER_STRENGTH = 64

export function nearestColor(r: number, g: number, b: number, palette: readonly RGB[]): RGB {
  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    const dr = r - c[0]
    const dg = g - c[1]
    const db = b - c[2]
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = c
    }
  }
  return best
}

export function quantize(data: Uint8ClampedArray, width: number, palette: readonly RGB[], dither: boolean): void {
  for (let i = 0; i < data.length; i += 4) {
    let offset = 0
    if (dither) {
      const p = i / 4
      const x = p % width
      const y = Math.floor(p / width)
      offset = (BAYER4[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * DITHER_STRENGTH
    }
    const [r, g, b] = nearestColor(data[i] + offset, data[i + 1] + offset, data[i + 2] + offset, palette)
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
}
```

- [ ] **Step 4: Implement `src/pixel/pixelate.ts`**

```ts
import { quantize, type RGB } from './quantize'

export interface PixelateOptions {
  width: number
  height: number
  palette: readonly RGB[]
  dither: boolean
  mirror: boolean
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

export function pixelate(source: CanvasImageSource, srcW: number, srcH: number, opts: PixelateOptions): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (opts.mirror) {
    ctx.translate(opts.width, 0)
    ctx.scale(-1, 1)
  }
  const { sx, sy, sw, sh } = coverCrop(srcW, srcH, opts.width, opts.height)
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, opts.width, opts.height)
  const image = ctx.getImageData(0, 0, opts.width, opts.height)
  quantize(image.data, opts.width, opts.palette, opts.dither)
  return image
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/pixel` → Expected: all pass. If the exact float in the landscape `coverCrop` test differs in the last digit, replace that assertion with `toBeCloseTo` on each field (`sx ≈ 331.43`, `sw ≈ 617.14`) — do not change the implementation.

- [ ] **Step 6: Commit**

```bash
git add src/pixel
git commit -m "feat: add pixelate and palette quantize with ordered dither"
```

---

### Task 3: Bitmap pixel font and draw helpers

**Files:**
- Create: `src/templates/draw.ts`, `src/templates/pixelFont.ts`, `src/templates/pixelFont.test.ts`

**Interfaces:**
- Consumes: `RGB` from `src/pixel/quantize.ts`
- Produces (`draw.ts`):
  - `interface Rect { x: number; y: number; w: number; h: number }` (also re-exported from `types.ts` in Task 4 — define it here)
  - `css(c: RGB): string`
  - `fill(ctx: CanvasRenderingContext2D, color: RGB, x: number, y: number, w: number, h: number): void`
  - `outline(ctx, color: RGB, x, y, w, h): void` — 1px border inside the given box
  - `drawBitmap(ctx, rows: readonly string[], x: number, y: number, color: RGB, scale?: number): void` — `'1'` = filled
  - `drawPhoto(ctx, photo: ImageData, rect: Rect): void`
- Produces (`pixelFont.ts`):
  - `GLYPH_H = 5`
  - `glyphFor(ch: string): readonly string[]` — unknown → `?` glyph; input char compared uppercase
  - `measureText(text: string, scale?: number): number`
  - `fitScale(text: string, maxWidth: number, maxScale: number): number`
  - `drawText(ctx, text, x, y, color: RGB, scale?: number): void`
  - `drawTextCentered(ctx, text, centerX, y, color: RGB, scale?: number): void`
  - `drawTextRight(ctx, text, right, y, color: RGB, scale?: number): void`

- [ ] **Step 1: Write failing tests** `src/templates/pixelFont.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { GLYPHS, drawText, fitScale, glyphFor, measureText } from './pixelFont'

describe('glyph table', () => {
  test('every glyph is 5 rows of 3 binary columns', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(5)
      for (const row of rows) expect(row, ch).toMatch(/^[01]{3}$/)
    }
  })
  test('covers A–Z, 0–9 and the cent sign', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789¢') expect(GLYPHS[ch], ch).toBeDefined()
  })
})

describe('glyphFor', () => {
  test('is case-insensitive', () => {
    expect(glyphFor('a')).toBe(GLYPHS.A)
  })
  test('falls back to ? for unknown characters', () => {
    expect(glyphFor('é')).toBe(GLYPHS['?'])
    expect(glyphFor('😀')).toBe(GLYPHS['?'])
  })
})

describe('measureText', () => {
  test('3px glyph + 1px gap, no trailing gap', () => {
    expect(measureText('')).toBe(0)
    expect(measureText('A')).toBe(3)
    expect(measureText('AB')).toBe(7)
    expect(measureText('AB', 2)).toBe(14)
  })
  test('counts an emoji as one character', () => {
    expect(measureText('😀')).toBe(3)
  })
})

describe('fitScale', () => {
  test('returns the largest scale that fits', () => {
    expect(fitScale('HI', 20, 2)).toBe(2) // 14px
    expect(fitScale('HELLO', 20, 2)).toBe(1) // 38px at 2x, 19px at 1x
    expect(fitScale('WAY TOO LONG TEXT', 10, 2)).toBe(1)
  })
})

describe('drawText', () => {
  test('does not throw on lowercase, accents, emoji, or empty text', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    expect(() => drawText(ctx, 'héllo 😀 wörld', 0, 0, [0, 0, 0])).not.toThrow()
    expect(() => drawText(ctx, '', 0, 0, [0, 0, 0], 2)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/templates/pixelFont.test.ts` → Expected: FAIL, cannot resolve `./pixelFont`.

- [ ] **Step 3: Implement `src/templates/draw.ts`**

```ts
import type { RGB } from '../pixel/quantize'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const css = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`

export function fill(ctx: CanvasRenderingContext2D, color: RGB, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = css(color)
  ctx.fillRect(x, y, w, h)
}

export function outline(ctx: CanvasRenderingContext2D, color: RGB, x: number, y: number, w: number, h: number) {
  fill(ctx, color, x, y, w, 1)
  fill(ctx, color, x, y + h - 1, w, 1)
  fill(ctx, color, x, y, 1, h)
  fill(ctx, color, x + w - 1, y, 1, h)
}

export function drawBitmap(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  color: RGB,
  scale = 1,
) {
  ctx.fillStyle = css(color)
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === '1') ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale)
    }
  })
}

export function drawPhoto(ctx: CanvasRenderingContext2D, photo: ImageData, rect: Rect) {
  const tmp = document.createElement('canvas')
  tmp.width = photo.width
  tmp.height = photo.height
  tmp.getContext('2d')!.putImageData(photo, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, rect.x, rect.y, rect.w, rect.h)
}
```

- [ ] **Step 4: Implement `src/templates/pixelFont.ts`**

```ts
import type { RGB } from '../pixel/quantize'
import { drawBitmap } from './draw'

export const GLYPH_W = 3
export const GLYPH_H = 5
const ADVANCE = GLYPH_W + 1

export const GLYPHS: Record<string, readonly string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '110', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'],
  '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '110'],
  ' ': ['000', '000', '000', '000', '000'],
  '.': ['000', '000', '000', '000', '010'],
  ',': ['000', '000', '000', '010', '100'],
  ':': ['000', '010', '000', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '!': ['010', '010', '010', '000', '010'],
  '?': ['110', '001', '010', '000', '010'],
  "'": ['010', '010', '000', '000', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '#': ['101', '111', '101', '111', '101'],
  $: ['011', '110', '010', '011', '110'],
  '%': ['101', '001', '010', '100', '101'],
  '&': ['010', '101', '010', '101', '011'],
  '+': ['000', '010', '111', '010', '000'],
  '*': ['101', '010', '101', '000', '000'],
  '¢': ['010', '111', '100', '111', '010'],
}

const chars = (text: string) => Array.from(text.toUpperCase())

export function glyphFor(ch: string): readonly string[] {
  return GLYPHS[ch.toUpperCase()] ?? GLYPHS['?']
}

export function measureText(text: string, scale = 1): number {
  const n = chars(text).length
  return n === 0 ? 0 : (n * ADVANCE - 1) * scale
}

export function fitScale(text: string, maxWidth: number, maxScale: number): number {
  for (let s = maxScale; s > 1; s--) {
    if (measureText(text, s) <= maxWidth) return s
  }
  return 1
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: RGB, scale = 1) {
  chars(text).forEach((ch, i) => drawBitmap(ctx, glyphFor(ch), x + i * ADVANCE * scale, y, color, scale))
}

export function drawTextCentered(ctx: CanvasRenderingContext2D, text: string, centerX: number, y: number, color: RGB, scale = 1) {
  drawText(ctx, text, Math.round(centerX - measureText(text, scale) / 2), y, color, scale)
}

export function drawTextRight(ctx: CanvasRenderingContext2D, text: string, right: number, y: number, color: RGB, scale = 1) {
  drawText(ctx, text, right - measureText(text, scale), y, color, scale)
}
```

Note: `chars()` uppercases first, so `'ß'` becomes `'SS'` (2 chars). That is fine; `measureText` and `drawText` both use `chars()` so they stay consistent.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/templates/pixelFont.test.ts` → Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/templates/draw.ts src/templates/pixelFont.ts src/templates/pixelFont.test.ts
git commit -m "feat: add 3x5 bitmap pixel font and canvas draw helpers"
```

---

### Task 4: Template contract, composer, Stamp template, registry

**Files:**
- Create: `src/templates/types.ts`, `src/templates/fields.ts`, `src/templates/stamp.ts`, `src/templates/registry.ts`, `src/templates/placeholder.ts`, `src/templates/templates.test.ts`
- Create: `src/render/composeStamp.ts`, `src/render/composeStamp.test.ts`, `src/render/export.ts`, `src/render/export.test.ts`

**Interfaces:**
- Consumes: `RGB` (Task 2); `Rect`, `fill`, `outline`, `drawPhoto`, `drawBitmap` (Task 3); `drawText`, `drawTextCentered`, `drawTextRight`, `fitScale` (Task 3)
- Produces:
  - `types.ts`: `TemplateField { key: string; label: string; default: string | (() => string); maxLength: number; perCapture?: boolean }`, `Template { id; name; size: { w: number; h: number }; photoRect: Rect; palette: readonly RGB[]; fields: readonly TemplateField[]; printSizeMm: { w: number; h: number }; render(ctx, photo: ImageData, values: Record<string, string>): void }`, re-export `Rect`
  - `fields.ts`: `resolveDefaults(t: Template): Record<string, string>`, `refreshPerCapture(t: Template, values: Record<string, string>): Record<string, string>`, `clampValue(field: TemplateField, value: string): string`
  - `registry.ts`: `templates: readonly Template[]`, `getTemplate(id: string): Template` (throws on unknown id), `photoSize(t: Template, pixelSize: number): { w: number; h: number }`
  - `placeholder.ts`: `placeholderPhoto(t: Template, pixelSize?: number): ImageData`
  - `composeStamp(template: Template, photo: ImageData, values: Record<string, string>, scale: number, target?: HTMLCanvasElement): HTMLCanvasElement`
  - `export.ts`: `PREVIEW_SCALE = 4`, `EXPORT_SCALE = 8`, `exportFileName(templateId: string, now?: Date): string`

- [ ] **Step 1: Write failing tests.** `src/templates/templates.test.ts` (contract test — runs over every registered template, so Task 5's templates are covered automatically):

```ts
import { describe, expect, test } from 'vitest'
import { clampValue, refreshPerCapture, resolveDefaults } from './fields'
import { placeholderPhoto } from './placeholder'
import { getTemplate, photoSize, templates } from './registry'

describe.each(templates.map((t) => [t.id, t] as const))('template %s', (_id, t) => {
  test('photoRect lies inside the template and is divisible by 12', () => {
    const r = t.photoRect
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(t.size.w)
    expect(r.y + r.h).toBeLessThanOrEqual(t.size.h)
    expect(r.w % 12).toBe(0)
    expect(r.h % 12).toBe(0)
  })

  test('field keys are unique and defaults fit maxLength', () => {
    const keys = t.fields.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
    const defaults = resolveDefaults(t)
    for (const f of t.fields) {
      expect(Array.from(defaults[f.key]).length, f.key).toBeLessThanOrEqual(f.maxLength)
    }
  })

  test('palette has at least 4 colors', () => {
    expect(t.palette.length).toBeGreaterThanOrEqual(4)
  })

  test('renders with defaults, max-length junk, and empty values without throwing', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const photo = placeholderPhoto(t, 3)
    expect(() => t.render(ctx, photo, resolveDefaults(t))).not.toThrow()
    const junk = Object.fromEntries(t.fields.map((f) => [f.key, 'é😀w'.repeat(f.maxLength).slice(0, f.maxLength)]))
    expect(() => t.render(ctx, photo, junk)).not.toThrow()
    expect(() => t.render(ctx, photo, {})).not.toThrow()
  })
})

describe('registry', () => {
  test('ids are unique and getTemplate finds each one', () => {
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(getTemplate(id).id).toBe(id)
  })
  test('getTemplate throws on unknown id', () => {
    expect(() => getTemplate('nope')).toThrow(/unknown template/i)
  })
  test('photoSize divides photoRect by pixel size', () => {
    const t = getTemplate('stamp')
    expect(photoSize(t, 3)).toEqual({ w: t.photoRect.w / 3, h: t.photoRect.h / 3 })
  })
})

describe('fields', () => {
  const t = getTemplate('stamp')
  test('clampValue limits by code points, not UTF-16 units', () => {
    const f = { key: 'k', label: 'K', default: '', maxLength: 3 }
    expect(clampValue(f, 'ABCDEF')).toBe('ABC')
    expect(clampValue(f, '😀😀😀😀')).toBe('😀😀😀')
  })
  test('refreshPerCapture keeps non-per-capture values', () => {
    const values = { ...resolveDefaults(t), title: 'MY EVENT' }
    expect(refreshPerCapture(t, values).title).toBe('MY EVENT')
  })
})

describe('placeholderPhoto', () => {
  test('has photoSize dimensions', () => {
    const t = getTemplate('stamp')
    const p = placeholderPhoto(t, 2)
    expect([p.width, p.height]).toEqual([t.photoRect.w / 2, t.photoRect.h / 2])
  })
})
```

`src/render/composeStamp.test.ts`:

```ts
import { expect, test } from 'vitest'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { getTemplate } from '../templates/registry'
import { composeStamp } from './composeStamp'

const t = getTemplate('stamp')
const photo = placeholderPhoto(t)

test('output is template size × scale', () => {
  const c = composeStamp(t, photo, resolveDefaults(t), 8)
  expect([c.width, c.height]).toEqual([t.size.w * 8, t.size.h * 8])
})

test('draws into and returns a provided target canvas', () => {
  const target = document.createElement('canvas')
  const c = composeStamp(t, photo, resolveDefaults(t), 2, target)
  expect(c).toBe(target)
  expect([target.width, target.height]).toEqual([t.size.w * 2, t.size.h * 2])
})

test('can be called repeatedly (future sheet layouts)', () => {
  for (let i = 0; i < 3; i++) composeStamp(t, photo, resolveDefaults(t), 1)
})

test('rejects non-integer or non-positive scale', () => {
  expect(() => composeStamp(t, photo, {}, 1.5)).toThrow(RangeError)
  expect(() => composeStamp(t, photo, {}, 0)).toThrow(RangeError)
})
```

`src/render/export.test.ts`:

```ts
import { expect, test } from 'vitest'
import { exportFileName } from './export'

test('filename has template id and a filesystem-safe timestamp', () => {
  const name = exportFileName('ticket', new Date('2026-10-13T09:05:07.123Z'))
  expect(name).toBe('pixel-booth-ticket-2026-10-13T09-05-07-123Z.png')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/templates/templates.test.ts src/render` → Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `src/templates/types.ts`**

```ts
import type { RGB } from '../pixel/quantize'
import type { Rect } from './draw'

export type { Rect }

export interface TemplateField {
  key: string
  label: string
  /** Function form for generated values (dates, serials). */
  default: string | (() => string)
  maxLength: number
  /** Regenerate this field's default on every capture (e.g. ticket serial). */
  perCapture?: boolean
}

export interface Template {
  id: string
  name: string
  /** In art pixels, before upscaling. */
  size: { w: number; h: number }
  photoRect: Rect
  palette: readonly RGB[]
  fields: readonly TemplateField[]
  printSizeMm: { w: number; h: number }
  /** Draws at art scale (1 unit = 1 art pixel). Must tolerate missing values. */
  render(ctx: CanvasRenderingContext2D, photo: ImageData, values: Record<string, string>): void
}
```

- [ ] **Step 4: Implement `src/templates/fields.ts`**

```ts
import type { Template, TemplateField } from './types'

const resolve = (f: TemplateField) => (typeof f.default === 'function' ? f.default() : f.default)

export function clampValue(field: TemplateField, value: string): string {
  return Array.from(value).slice(0, field.maxLength).join('')
}

export function resolveDefaults(t: Template): Record<string, string> {
  return Object.fromEntries(t.fields.map((f) => [f.key, clampValue(f, resolve(f))]))
}

export function refreshPerCapture(t: Template, values: Record<string, string>): Record<string, string> {
  const next = { ...values }
  for (const f of t.fields) if (f.perCapture) next[f.key] = clampValue(f, resolve(f))
  return next
}
```

- [ ] **Step 5: Implement `src/templates/stamp.ts`**

```ts
import type { RGB } from '../pixel/quantize'
import { drawPhoto, fill, outline } from './draw'
import { drawText, drawTextCentered, drawTextRight } from './pixelFont'
import type { Template } from './types'

const W = 96
const H = 120
const PHOTO = { x: 12, y: 12, w: 72, h: 84 }

const PAPER: RGB = [244, 233, 208]
const INK: RGB = [43, 36, 64]
const RED: RGB = [200, 64, 64]

export const stamp: Template = {
  id: 'stamp',
  name: 'Stamp',
  size: { w: W, h: H },
  photoRect: PHOTO,
  palette: [PAPER, INK, RED, [232, 144, 72], [240, 200, 96], [88, 152, 96], [72, 112, 176], [216, 160, 128]],
  printSizeMm: { w: 48, h: 60 },
  fields: [
    { key: 'title', label: 'Title', default: 'FIRST STAMP', maxLength: 14 },
    { key: 'value', label: 'Value', default: '25¢', maxLength: 5 },
  ],
  render(ctx, photo, values) {
    fill(ctx, PAPER, 0, 0, W, H)

    // Perforated edge: a notch every 6px on all four sides.
    for (let x = 1; x + 4 <= W; x += 6) {
      ctx.clearRect(x, 0, 4, 2)
      ctx.clearRect(x + 1, 2, 2, 1)
      ctx.clearRect(x, H - 2, 4, 2)
      ctx.clearRect(x + 1, H - 3, 2, 1)
    }
    for (let y = 1; y + 4 <= H; y += 6) {
      ctx.clearRect(0, y, 2, 4)
      ctx.clearRect(2, y + 1, 1, 2)
      ctx.clearRect(W - 2, y, 2, 4)
      ctx.clearRect(W - 3, y + 1, 1, 2)
    }

    outline(ctx, INK, 6, 6, W - 12, H - 12)
    outline(ctx, INK, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
    drawPhoto(ctx, photo, PHOTO)

    drawTextCentered(ctx, values.title ?? '', W / 2, 100, RED)
    drawText(ctx, 'PIXEL POST', 10, 107, INK)
    drawTextRight(ctx, values.value ?? '', 86, 107, INK)
  },
}
```

- [ ] **Step 6: Implement `src/templates/registry.ts`** (Task 5 adds voucher and ticket to this list)

```ts
import { stamp } from './stamp'
import type { Template } from './types'

export const templates: readonly Template[] = [stamp]

export function getTemplate(id: string): Template {
  const t = templates.find((t) => t.id === id)
  if (!t) throw new Error(`Unknown template: ${id}`)
  return t
}

export function photoSize(t: Template, pixelSize: number) {
  return { w: t.photoRect.w / pixelSize, h: t.photoRect.h / pixelSize }
}
```

- [ ] **Step 7: Implement `src/templates/placeholder.ts`** — a pixel smiley used by the picker and the idle booth

```ts
import { photoSize } from './registry'
import type { Template } from './types'

export function placeholderPhoto(t: Template, pixelSize = 3): ImageData {
  const { w, h } = photoSize(t, pixelSize)
  const img = new ImageData(w, h)
  const bg = t.palette[3]
  const face = t.palette[t.palette.length - 1]
  const ink = t.palette[1]
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const r = Math.min(w, h) * 0.38
  const eyeR = r * 0.14

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy)
      const leftEye = Math.hypot(x - (cx - r * 0.38), y - (cy - r * 0.25)) < eyeR
      const rightEye = Math.hypot(x - (cx + r * 0.38), y - (cy - r * 0.25)) < eyeR
      const mouth = d > r * 0.45 && d < r * 0.62 && y > cy + r * 0.15
      const c = d < r ? (leftEye || rightEye || mouth ? ink : face) : bg
      const i = (y * w + x) * 4
      img.data[i] = c[0]
      img.data[i + 1] = c[1]
      img.data[i + 2] = c[2]
      img.data[i + 3] = 255
    }
  }
  return img
}
```

- [ ] **Step 8: Implement `src/render/composeStamp.ts`**

```ts
import type { Template } from '../templates/types'

/**
 * Renders a template at art scale, then upscales by an integer with no smoothing.
 * Shared by preview, download, and print so all three match exactly.
 */
export function composeStamp(
  template: Template,
  photo: ImageData,
  values: Record<string, string>,
  scale: number,
  target?: HTMLCanvasElement,
): HTMLCanvasElement {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new RangeError(`scale must be a positive integer, got ${scale}`)
  }
  const { w, h } = template.size
  const art = document.createElement('canvas')
  art.width = w
  art.height = h
  template.render(art.getContext('2d')!, photo, values)

  const out = target ?? document.createElement('canvas')
  if (out.width !== w * scale) out.width = w * scale
  if (out.height !== h * scale) out.height = h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, out.width, out.height)
  ctx.drawImage(art, 0, 0, out.width, out.height)
  return out
}
```

- [ ] **Step 9: Implement `src/render/export.ts`**

```ts
export const PREVIEW_SCALE = 4
export const EXPORT_SCALE = 8

export function exportFileName(templateId: string, now = new Date()): string {
  return `pixel-booth-${templateId}-${now.toISOString().replace(/[:.]/g, '-')}.png`
}
```

- [ ] **Step 10: Run tests**

Run: `npm test` → Expected: all pass. Run: `npx tsc -b` → Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add src/templates src/render
git commit -m "feat: add template contract, stamp template, and composer"
```

---

### Task 5: Voucher and Ticket templates

**Files:**
- Create: `src/templates/voucher.ts`, `src/templates/ticket.ts`, `src/templates/ticket.test.ts`
- Modify: `src/templates/registry.ts` (add to list)

**Interfaces:**
- Consumes: everything Task 4 produces; draw helpers and font from Task 3
- Produces: `voucher: Template` (id `'voucher'`), `ticket: Template` (id `'ticket'`), `todayIso(now?: Date): string`, `randomSerial(rand?: () => number): string`

- [ ] **Step 1: Write failing tests** `src/templates/ticket.test.ts`:

```ts
import { expect, test } from 'vitest'
import { refreshPerCapture, resolveDefaults } from './fields'
import { getTemplate } from './registry'
import { randomSerial, todayIso } from './ticket'

test('todayIso uses local date as YYYY-MM-DD', () => {
  expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
})

test('randomSerial is "NO. " + 6 zero-padded digits', () => {
  expect(randomSerial(() => 0)).toBe('NO. 000000')
  expect(randomSerial(() => 0.000123)).toBe('NO. 000123')
  expect(randomSerial(() => 0.9999999)).toBe('NO. 999999')
})

test('ticket serial regenerates per capture; event name is kept', () => {
  const t = getTemplate('ticket')
  const values = { ...resolveDefaults(t), event: 'GRAD NIGHT', serial: 'NO. 111111' }
  const next = refreshPerCapture(t, values)
  expect(next.event).toBe('GRAD NIGHT')
  expect(next.serial).toMatch(/^NO\. \d{6}$/)
})

test('registry lists stamp, voucher, ticket in order', async () => {
  const { templates } = await import('./registry')
  expect(templates.map((t) => t.id)).toEqual(['stamp', 'voucher', 'ticket'])
})
```

(The `next.serial` could by chance equal `'NO. 111111'`; the regex assertion is what matters.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/templates` → Expected: FAIL, cannot resolve `./ticket`.

- [ ] **Step 3: Implement `src/templates/voucher.ts`**

```ts
import type { RGB } from '../pixel/quantize'
import { drawBitmap, drawPhoto, fill, outline } from './draw'
import { drawTextCentered, fitScale } from './pixelFont'
import type { Template } from './types'

const W = 192
const H = 96
const PHOTO = { x: 6, y: 6, w: 72, h: 84 }
const CUT = 150
const TEXT_CX = 115 // center of the 84..146 text area
const STUB_CX = 170

const PAPER: RGB = [250, 240, 220]
const INK: RGB = [32, 48, 40]
const GREEN: RGB = [64, 128, 88]
const PINK: RGB = [224, 136, 136]

const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000']

export const voucher: Template = {
  id: 'voucher',
  name: 'Voucher',
  size: { w: W, h: H },
  photoRect: PHOTO,
  palette: [PAPER, INK, GREEN, [136, 192, 120], [224, 176, 64], [240, 216, 160], [128, 88, 56], PINK],
  printSizeMm: { w: 120, h: 60 },
  fields: [
    { key: 'title', label: 'Title', default: 'VOUCHER', maxLength: 14 },
    { key: 'amount', label: 'Amount', default: 'FREE HUG', maxLength: 12 },
    { key: 'expires', label: 'Expires', default: 'VALID TODAY', maxLength: 14 },
  ],
  render(ctx, photo, values) {
    fill(ctx, PAPER, 0, 0, W, H)
    outline(ctx, INK, 2, 2, W - 4, H - 4)
    outline(ctx, INK, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
    drawPhoto(ctx, photo, PHOTO)

    // Dashed cut line with notches top and bottom.
    for (let y = 4; y < H - 4; y += 5) fill(ctx, INK, CUT, y, 1, 3)
    ctx.clearRect(CUT - 2, 0, 5, 2)
    ctx.clearRect(CUT - 1, 2, 3, 1)
    ctx.clearRect(CUT - 2, H - 2, 5, 2)
    ctx.clearRect(CUT - 1, H - 3, 3, 1)

    drawTextCentered(ctx, values.title ?? '', TEXT_CX, 12, GREEN)
    fill(ctx, INK, 86, 20, 58, 1)
    const amount = values.amount ?? ''
    const s = fitScale(amount, 62, 2)
    drawTextCentered(ctx, amount, TEXT_CX, s === 2 ? 36 : 38, INK, s)
    fill(ctx, INK, 86, 56, 58, 1)
    drawTextCentered(ctx, values.expires ?? '', TEXT_CX, 64, INK)

    drawTextCentered(ctx, 'KEEP', STUB_CX, 30, INK)
    drawBitmap(ctx, HEART, STUB_CX - 3, 41, PINK)
    drawTextCentered(ctx, 'THIS', STUB_CX, 54, INK)
  },
}
```

- [ ] **Step 4: Implement `src/templates/ticket.ts`**

```ts
import type { RGB } from '../pixel/quantize'
import { drawPhoto, fill, outline } from './draw'
import { drawTextCentered, fitScale } from './pixelFont'
import type { Template } from './types'

const W = 192
const H = 80
const PHOTO = { x: 6, y: 4, w: 60, h: 72 }
const STUB = 152
const TEXT_CX = 109
const STUB_CX = 171

const PAPER: RGB = [255, 236, 200]
const INK: RGB = [40, 24, 48]
const MAGENTA: RGB = [176, 48, 112]

const pad = (n: number, len: number) => String(n).padStart(len, '0')

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`
}

export function randomSerial(rand: () => number = Math.random): string {
  return `NO. ${pad(Math.floor(rand() * 1_000_000), 6)}`
}

export const ticket: Template = {
  id: 'ticket',
  name: 'Ticket',
  size: { w: W, h: H },
  photoRect: PHOTO,
  palette: [PAPER, INK, MAGENTA, [96, 64, 160], [72, 176, 200], [248, 208, 80], [232, 112, 64], [240, 176, 144]],
  printSizeMm: { w: 144, h: 60 },
  fields: [
    { key: 'event', label: 'Event', default: 'PIXEL PARTY', maxLength: 14 },
    { key: 'date', label: 'Date', default: () => todayIso(), maxLength: 10 },
    { key: 'serial', label: 'Serial', default: () => randomSerial(), maxLength: 10, perCapture: true },
  ],
  render(ctx, photo, values) {
    fill(ctx, PAPER, 0, 0, W, H)

    // Side notches and stub notches.
    ctx.clearRect(0, 34, 2, 12)
    ctx.clearRect(2, 36, 1, 8)
    ctx.clearRect(W - 2, 34, 2, 12)
    ctx.clearRect(W - 3, 36, 1, 8)
    ctx.clearRect(STUB - 2, 0, 5, 2)
    ctx.clearRect(STUB - 1, 2, 3, 1)
    ctx.clearRect(STUB - 2, H - 2, 5, 2)
    ctx.clearRect(STUB - 1, H - 3, 3, 1)

    outline(ctx, INK, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
    drawPhoto(ctx, photo, PHOTO)
    for (let y = 4; y < H - 4; y += 4) fill(ctx, INK, STUB, y, 1, 2)

    drawTextCentered(ctx, 'ADMIT ONE', TEXT_CX, 6, MAGENTA, 2)
    fill(ctx, INK, 72, 20, 74, 1)
    const event = values.event ?? ''
    const s = fitScale(event, 74, 2)
    drawTextCentered(ctx, event, TEXT_CX, s === 2 ? 28 : 30, INK, s)
    drawTextCentered(ctx, values.date ?? '', TEXT_CX, 50, INK)
    fill(ctx, INK, 72, 60, 74, 1)
    drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 66, MAGENTA)

    drawTextCentered(ctx, 'ADMIT', STUB_CX, 10, MAGENTA)
    drawTextCentered(ctx, 'ONE', STUB_CX, 18, MAGENTA)
    const lines = (values.serial ?? '').split(' ').filter(Boolean).slice(0, 3)
    lines.forEach((line, i) => drawTextCentered(ctx, line.slice(0, 9), STUB_CX, 36 + i * 8, INK))
  },
}
```

- [ ] **Step 5: Register them** — in `src/templates/registry.ts`:

```ts
import { stamp } from './stamp'
import { ticket } from './ticket'
import type { Template } from './types'
import { voucher } from './voucher'

export const templates: readonly Template[] = [stamp, voucher, ticket]
```

(keep `getTemplate` and `photoSize` unchanged)

- [ ] **Step 6: Run tests**

Run: `npm test` → Expected: all pass, including the contract test now running for voucher and ticket.

- [ ] **Step 7: Commit**

```bash
git add src/templates
git commit -m "feat: add voucher and ticket templates"
```

---

### Task 6: Booth store

**Files:**
- Create: `src/store/booth.ts`, `src/store/booth.test.ts`

**Interfaces:**
- Consumes: `getTemplate`, `resolveDefaults`, `refreshPerCapture`, `clampValue`
- Produces:
  - `type Screen = 'picker' | 'booth' | 'editor'`
  - `type PixelSize = 1 | 2 | 3 | 4`, `PIXEL_SIZES: readonly PixelSize[]`
  - `useBooth` (Zustand hook) with state `{ screen, templateId, pixelSize, dither, capture: ImageData | null, values: Record<string, string> }` and actions `selectTemplate(id)`, `setPixelSize(p)`, `setDither(on)`, `setCapture(photo)`, `retake()`, `goToPicker()`, `setValue(key, value)`

- [ ] **Step 1: Write failing tests** `src/store/booth.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest'
import { useBooth } from './booth'

const s = () => useBooth.getState()

beforeEach(() => useBooth.setState(useBooth.getInitialState(), true))

describe('booth store', () => {
  test('starts on the picker with stamp defaults', () => {
    expect(s().screen).toBe('picker')
    expect(s().templateId).toBe('stamp')
    expect(s().values.title).toBe('FIRST STAMP')
  })

  test('selectTemplate switches template, resets values, and opens the booth', () => {
    s().selectTemplate('ticket')
    expect(s().screen).toBe('booth')
    expect(s().templateId).toBe('ticket')
    expect(s().values.event).toBe('PIXEL PARTY')
    expect(s().capture).toBeNull()
  })

  test('re-selecting the same template keeps edited values', () => {
    s().selectTemplate('ticket')
    s().setValue('event', 'GRAD NIGHT')
    s().goToPicker()
    s().selectTemplate('ticket')
    expect(s().values.event).toBe('GRAD NIGHT')
  })

  test('setCapture stores the photo, opens the editor, and refreshes per-capture fields only', () => {
    s().selectTemplate('ticket')
    s().setValue('event', 'GRAD NIGHT')
    s().setValue('serial', 'NO. 111111')
    const photo = new ImageData(20, 24)
    s().setCapture(photo)
    expect(s().capture).toBe(photo)
    expect(s().screen).toBe('editor')
    expect(s().values.event).toBe('GRAD NIGHT')
    expect(s().values.serial).toMatch(/^NO\. \d{6}$/)
  })

  test('retake clears the capture, keeps values, returns to the booth', () => {
    s().selectTemplate('stamp')
    s().setValue('title', 'HELLO')
    s().setCapture(new ImageData(24, 28))
    s().retake()
    expect(s().capture).toBeNull()
    expect(s().screen).toBe('booth')
    expect(s().values.title).toBe('HELLO')
  })

  test('setValue clamps pasted text to maxLength by code point', () => {
    s().setValue('value', '😀😀😀😀😀😀😀')
    expect(Array.from(s().values.value)).toHaveLength(5)
    s().setValue('title', 'X'.repeat(100))
    expect(s().values.title).toBe('X'.repeat(14))
  })

  test('setValue ignores keys the template does not have', () => {
    s().setValue('nope', 'x')
    expect(s().values).not.toHaveProperty('nope')
  })

  test('pixel size and dither setters', () => {
    s().setPixelSize(4)
    s().setDither(false)
    expect(s().pixelSize).toBe(4)
    expect(s().dither).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store` → Expected: FAIL, cannot resolve `./booth`.

- [ ] **Step 3: Implement `src/store/booth.ts`**

```ts
import { create } from 'zustand'
import { clampValue, refreshPerCapture, resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'

export type Screen = 'picker' | 'booth' | 'editor'
export type PixelSize = 1 | 2 | 3 | 4
export const PIXEL_SIZES: readonly PixelSize[] = [1, 2, 3, 4]

interface BoothState {
  screen: Screen
  templateId: string
  pixelSize: PixelSize
  dither: boolean
  capture: ImageData | null
  values: Record<string, string>
  selectTemplate(id: string): void
  setPixelSize(p: PixelSize): void
  setDither(on: boolean): void
  setCapture(photo: ImageData): void
  retake(): void
  goToPicker(): void
  setValue(key: string, value: string): void
}

export const useBooth = create<BoothState>()((set, get) => ({
  screen: 'picker',
  templateId: 'stamp',
  pixelSize: 3,
  dither: true,
  capture: null,
  values: resolveDefaults(getTemplate('stamp')),

  selectTemplate(id) {
    const same = id === get().templateId
    set({
      templateId: id,
      values: same ? get().values : resolveDefaults(getTemplate(id)),
      capture: null,
      screen: 'booth',
    })
  },
  setPixelSize: (pixelSize) => set({ pixelSize }),
  setDither: (dither) => set({ dither }),
  setCapture(photo) {
    const t = getTemplate(get().templateId)
    set({ capture: photo, values: refreshPerCapture(t, get().values), screen: 'editor' })
  },
  retake: () => set({ capture: null, screen: 'booth' }),
  goToPicker: () => set({ capture: null, screen: 'picker' }),
  setValue(key, value) {
    const field = getTemplate(get().templateId).fields.find((f) => f.key === key)
    if (!field) return
    set({ values: { ...get().values, [key]: clampValue(field, value) } })
  },
}))
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/store` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat: add booth store with per-capture field refresh"
```

---

### Task 7: Camera hook

**Files:**
- Create: `src/camera/useCamera.ts`, `src/camera/useCamera.test.ts`

**Interfaces:**
- Produces: `type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'insecure'`; `useCamera(): { videoRef: RefObject<HTMLVideoElement | null>; status: CameraStatus; start(): Promise<void>; stop(): void }`

- [ ] **Step 1: Write failing tests** `src/camera/useCamera.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useCamera } from './useCamera'

function fakeStream() {
  const track = { stop: vi.fn() }
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream }
}

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  const getUserMedia = vi.fn(impl)
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  return getUserMedia
}

beforeEach(() => {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('insecure context reports insecure without requesting the camera', async () => {
  Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
  const gum = mockGetUserMedia(() => Promise.reject(new Error('should not be called')))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('insecure')
  expect(gum).not.toHaveBeenCalled()
})

test('permission denied reports denied', async () => {
  mockGetUserMedia(() => Promise.reject(new DOMException('no', 'NotAllowedError')))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('denied')
})

test('no camera reports unavailable', async () => {
  mockGetUserMedia(() => Promise.reject(new DOMException('none', 'NotFoundError')))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('unavailable')
})

test('success goes live; stop() stops tracks and returns to idle', async () => {
  const { track, stream } = fakeStream()
  mockGetUserMedia(() => Promise.resolve(stream))
  const { result } = renderHook(() => useCamera())
  await act(() => result.current.start())
  expect(result.current.status).toBe('live')
  act(() => result.current.stop())
  expect(track.stop).toHaveBeenCalled()
  expect(result.current.status).toBe('idle')
})

test('unmount stops a live stream', async () => {
  const { track, stream } = fakeStream()
  mockGetUserMedia(() => Promise.resolve(stream))
  const { result, unmount } = renderHook(() => useCamera())
  await act(() => result.current.start())
  unmount()
  expect(track.stop).toHaveBeenCalled()
})

test('stream that arrives after unmount is stopped immediately', async () => {
  const { track, stream } = fakeStream()
  let resolve!: (s: MediaStream) => void
  mockGetUserMedia(() => new Promise((r) => (resolve = r)))
  const { result, unmount } = renderHook(() => useCamera())
  let pending!: Promise<void>
  act(() => {
    pending = result.current.start()
  })
  unmount()
  resolve(stream)
  await pending
  expect(track.stop).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/camera` → Expected: FAIL, cannot resolve `./useCamera`.

- [ ] **Step 3: Implement `src/camera/useCamera.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'insecure'

const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop())

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Bumped by stop/unmount so a getUserMedia call that resolves later knows it is stale.
  const generation = useRef(0)
  const [status, setStatus] = useState<CameraStatus>('idle')

  const release = useCallback(() => {
    generation.current++
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const stop = useCallback(() => {
    release()
    setStatus('idle')
  }, [release])

  const start = useCallback(async () => {
    if (!window.isSecureContext) return setStatus('insecure')
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unavailable')
    release()
    const mine = generation.current
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      if (mine !== generation.current) {
        stopStream(stream)
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.play().catch(() => {})
      }
      setStatus('live')
    } catch (err) {
      if (mine !== generation.current) return
      const name = err instanceof DOMException ? err.name : ''
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }, [release])

  useEffect(() => release, [release])

  return { videoRef, status, start, stop }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/camera` → Expected: all 6 pass. (If React warns about a state update after unmount in the last test, that is acceptable only if no `setStatus` runs — the stale-generation early return should prevent it.)

- [ ] **Step 5: Commit**

```bash
git add src/camera
git commit -m "feat: add useCamera hook that releases late-arriving streams"
```

---

### Task 8: App shell, styles, and Template Picker

**Files:**
- Modify: `src/App.tsx`, `src/index.css`
- Create: `src/screens/TemplatePicker.tsx`, `src/screens/StampCanvas.tsx`

**Interfaces:**
- Consumes: `useBooth`, `templates`, `resolveDefaults`, `placeholderPhoto`, `composeStamp`
- Produces: `<StampCanvas template photo values scale label />` — a `<canvas>` re-rendered with `composeStamp` whenever props change (used by Picker and Editor)

- [ ] **Step 1: Create `src/screens/StampCanvas.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { composeStamp } from '../render/composeStamp'
import type { Template } from '../templates/types'

interface Props {
  template: Template
  photo: ImageData
  values: Record<string, string>
  scale: number
  label: string
}

export function StampCanvas({ template, photo, values, scale, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) composeStamp(template, photo, values, scale, ref.current)
  }, [template, photo, values, scale])
  return <canvas ref={ref} className="stamp-canvas" role="img" aria-label={label} />
}
```

- [ ] **Step 2: Create `src/screens/TemplatePicker.tsx`**

```tsx
import { useMemo } from 'react'
import { useBooth } from '../store/booth'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { templates } from '../templates/registry'
import { StampCanvas } from './StampCanvas'

export function TemplatePicker() {
  const selectTemplate = useBooth((s) => s.selectTemplate)
  const previews = useMemo(
    () => templates.map((t) => ({ t, photo: placeholderPhoto(t), values: resolveDefaults(t) })),
    [],
  )
  return (
    <section className="screen">
      <h2>Choose your print</h2>
      <div className="picker-grid">
        {previews.map(({ t, photo, values }) => (
          <button key={t.id} className="picker-card" onClick={() => selectTemplate(t.id)}>
            <StampCanvas template={t} photo={photo} values={values} scale={2} label={`${t.name} preview`} />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Update `src/App.tsx`** (Booth and Editor are added in Tasks 9 and 10; render placeholders for now)

```tsx
import { TemplatePicker } from './screens/TemplatePicker'
import { useBooth } from './store/booth'

export default function App() {
  const screen = useBooth((s) => s.screen)
  return (
    <main className="app">
      <h1 className="logo">PIXEL BOOTH</h1>
      {screen === 'picker' && <TemplatePicker />}
      {screen === 'booth' && <p>Booth coming soon</p>}
      {screen === 'editor' && <p>Editor coming soon</p>}
    </main>
  )
}
```

- [ ] **Step 4: Write `src/index.css`**

```css
:root {
  --bg: #1b1426;
  --panel: #2a2040;
  --ink: #f4e9d0;
  --muted: #a99bc4;
  --accent: #e8905a;
  --accent-ink: #1b1426;
  --danger: #e86a6a;
  --pixel: 'Press Start 2P', ui-monospace, monospace;
  color-scheme: dark;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
}

.app { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
.logo { font: 20px/1.4 var(--pixel); text-align: center; margin: 8px 0 24px; color: var(--accent); }
h2 { font: 12px/1.6 var(--pixel); text-align: center; margin: 0 0 20px; }
.screen { display: flex; flex-direction: column; align-items: center; gap: 16px; }

.stamp-canvas { image-rendering: pixelated; max-width: 100%; height: auto; display: block; }

.picker-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; align-items: flex-end; }
.picker-card {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  background: var(--panel); border: 2px solid transparent; padding: 16px; cursor: pointer;
  color: var(--ink); font: 10px var(--pixel);
}
.picker-card:hover, .picker-card:focus-visible { border-color: var(--accent); outline: none; }

button.btn, .btn {
  font: 10px/1 var(--pixel); padding: 12px 16px; cursor: pointer;
  background: var(--panel); color: var(--ink); border: 2px solid var(--ink);
  box-shadow: 4px 4px 0 #000;
}
.btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 2px 2px 0 #000; }
.row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; align-items: center; }

.preview-wrap { position: relative; }
.preview-wrap canvas { width: min(100%, 480px); }
.countdown {
  position: absolute; inset: 0; display: grid; place-items: center;
  font: 64px var(--pixel); color: var(--ink); text-shadow: 4px 4px 0 #000;
}
.video-feed { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.controls { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; align-items: center; font-size: 14px; }
.segmented { display: flex; gap: 4px; }
.segmented button[aria-pressed='true'] { background: var(--ink); color: var(--bg); }

.notice { background: var(--panel); padding: 16px; max-width: 480px; text-align: center; border-left: 4px solid var(--danger); }
.error { color: var(--danger); }

.fields { display: grid; gap: 12px; width: min(100%, 480px); }
.fields label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
.fields input {
  font: 14px var(--pixel); text-transform: uppercase; padding: 10px;
  background: var(--panel); color: var(--ink); border: 2px solid var(--muted);
}
.fields input:focus { border-color: var(--accent); outline: none; }

.print-only { display: none; }

@media print {
  @page { margin: 10mm; }
  body { background: #fff; }
  .app > *:not(.print-only) { display: none !important; }
  .print-only { display: block; }
  .print-only img { image-rendering: pixelated; }
}
```

Note: the print rule hides everything in `.app` except `.print-only`; Task 10 renders `.print-only` as a direct child of `.app` via the Editor (it must sit directly under `.app` — see Task 10 Step 2).

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open the printed localhost URL. Expected: dark page, "PIXEL BOOTH" logo, three cards (Stamp, Voucher, Ticket) each showing a smiley in its pixel frame with default text; clicking a card shows "Booth coming soon". Check at a ~375px-wide viewport: cards wrap, no horizontal scroll.

Run: `npm test && npm run build && npm run lint` → Expected: all succeed.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/index.css src/screens
git commit -m "feat: add app shell, retro styles, and template picker"
```

---

### Task 9: Booth screen (live preview, countdown, capture, upload)

**Files:**
- Create: `src/screens/Booth.tsx`
- Modify: `src/App.tsx` (render `<Booth />` for `screen === 'booth'`)

**Interfaces:**
- Consumes: `useCamera`, `useBooth`, `PIXEL_SIZES`, `getTemplate`, `photoSize`, `placeholderPhoto`, `pixelate`, `composeStamp`, `PREVIEW_SCALE`

- [ ] **Step 1: Create `src/screens/Booth.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useCamera, type CameraStatus } from '../camera/useCamera'
import { pixelate } from '../pixel/pixelate'
import { composeStamp } from '../render/composeStamp'
import { PREVIEW_SCALE } from '../render/export'
import { PIXEL_SIZES, useBooth } from '../store/booth'
import { placeholderPhoto } from '../templates/placeholder'
import { getTemplate, photoSize } from '../templates/registry'
import type { Template } from '../templates/types'

const MESSAGES: Partial<Record<CameraStatus, string>> = {
  insecure: 'The camera only works over HTTPS (or on localhost). You can still upload a photo.',
  denied: 'Camera access was blocked. Allow it in your browser’s site settings, then retry — or upload a photo.',
  unavailable: 'No camera was found. Plug one in and retry, or upload a photo.',
}

function framePhoto(template: Template, source: CanvasImageSource, w: number, h: number, mirror: boolean) {
  const { pixelSize, dither } = useBooth.getState()
  const size = photoSize(template, pixelSize)
  return pixelate(source, w, h, { width: size.w, height: size.h, palette: template.palette, dither, mirror })
}

export function Booth() {
  const templateId = useBooth((s) => s.templateId)
  const pixelSize = useBooth((s) => s.pixelSize)
  const dither = useBooth((s) => s.dither)
  const values = useBooth((s) => s.values)
  const { setPixelSize, setDither, setCapture, goToPicker } = useBooth.getState()
  const template = getTemplate(templateId)

  const { videoRef, status, start } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [count, setCount] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    void start()
  }, [start])

  // Idle preview: smiley placeholder until the camera is live.
  useEffect(() => {
    if (status === 'live' || !canvasRef.current) return
    composeStamp(template, placeholderPhoto(template, pixelSize), values, PREVIEW_SCALE, canvasRef.current)
  }, [status, template, pixelSize, values])

  // Live preview loop.
  useEffect(() => {
    if (status !== 'live') return
    let raf = 0
    const tick = () => {
      const v = videoRef.current
      const c = canvasRef.current
      if (v && c && v.videoWidth > 0) {
        const photo = framePhoto(template, v, v.videoWidth, v.videoHeight, true)
        composeStamp(template, photo, useBooth.getState().values, PREVIEW_SCALE, c)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, template, videoRef])

  const capture = useCallback(() => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) return
    setCapture(framePhoto(template, v, v.videoWidth, v.videoHeight, true))
  }, [template, videoRef, setCapture])

  // Countdown 3 → 2 → 1 → capture.
  useEffect(() => {
    if (count === null) return
    if (count === 0) {
      setCount(null)
      capture()
      return
    }
    const id = setTimeout(() => setCount(count - 1), 1000)
    return () => clearTimeout(id)
  }, [count, capture])

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    try {
      const bmp = await createImageBitmap(file)
      const photo = framePhoto(template, bmp, bmp.width, bmp.height, false)
      bmp.close()
      setCapture(photo)
    } catch {
      setUploadError('That file couldn’t be read as an image. Try a JPG or PNG.')
    }
  }

  const message = MESSAGES[status]

  return (
    <section className="screen">
      <h2>{template.name}</h2>
      <video ref={videoRef} className="video-feed" muted playsInline aria-hidden="true" />

      <div className="preview-wrap">
        <canvas ref={canvasRef} className="stamp-canvas" role="img" aria-label={`${template.name} live preview`} />
        {count !== null && count > 0 && <div className="countdown" aria-live="assertive">{count}</div>}
      </div>

      {message && (
        <div className="notice" role="alert">
          <p>{message}</p>
          {status !== 'insecure' && <button className="btn" onClick={() => void start()}>Retry camera</button>}
        </div>
      )}
      {status === 'requesting' && <p>Waiting for camera permission…</p>}

      <div className="controls">
        <span>Pixel size</span>
        <div className="segmented" role="group" aria-label="Pixel size">
          {PIXEL_SIZES.map((p) => (
            <button key={p} className="btn" aria-pressed={p === pixelSize} onClick={() => setPixelSize(p)}>{p}</button>
          ))}
        </div>
        <label>
          <input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} /> Dither
        </label>
      </div>

      <div className="row">
        <button className="btn" onClick={goToPicker}>Back</button>
        <button className="btn primary" disabled={status !== 'live' || count !== null} onClick={() => setCount(3)}>
          Take photo
        </button>
        <label className="btn">
          Upload photo
          <input type="file" accept="image/*" hidden onChange={onUpload} />
        </label>
      </div>
      {uploadError && <p className="error" role="alert">{uploadError}</p>}
    </section>
  )
}
```

- [ ] **Step 2: Wire into `src/App.tsx`** — replace the booth placeholder line with `{screen === 'booth' && <Booth />}` and add `import { Booth } from './screens/Booth'`.

- [ ] **Step 3: Verify in the browser** (`npm run dev`, Chrome)

Expected:
1. Pick Stamp → permission prompt → live mirrored, pixelated preview inside the stamp frame.
2. Pixel size 1–4 changes chunkiness live; Dither toggle visibly changes texture.
3. Take photo → 3, 2, 1 → screen switches to "Editor coming soon".
4. Back → camera indicator light turns off.
5. Block camera in site settings → reload → pick a template → "blocked" notice with Retry; Upload a JPG → goes to editor placeholder. Upload a `.txt` renamed `.png` → inline error, stays on Booth.
6. Upload a portrait phone photo → face is cropped, not stretched (verify once Editor exists in Task 10).

Run: `npm test && npm run build && npm run lint` → Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Booth.tsx src/App.tsx
git commit -m "feat: add booth screen with live pixel preview, countdown, and upload"
```

---

### Task 10: Editor screen (fields, download, print)

**Files:**
- Create: `src/screens/Editor.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useBooth`, `getTemplate`, `composeStamp`, `StampCanvas`, `PREVIEW_SCALE`, `EXPORT_SCALE`, `exportFileName`

- [ ] **Step 1: Create `src/screens/Editor.tsx`**

```tsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { composeStamp } from '../render/composeStamp'
import { EXPORT_SCALE, PREVIEW_SCALE, exportFileName } from '../render/export'
import { useBooth } from '../store/booth'
import { getTemplate } from '../templates/registry'
import { StampCanvas } from './StampCanvas'

export function Editor() {
  const templateId = useBooth((s) => s.templateId)
  const capture = useBooth((s) => s.capture)
  const values = useBooth((s) => s.values)
  const { setValue, retake, goToPicker } = useBooth.getState()
  const template = getTemplate(templateId)
  const [print, setPrint] = useState<{ url: string; n: number } | null>(null)

  if (!capture) return null

  const render = () => composeStamp(template, capture, values, EXPORT_SCALE)

  function download() {
    render().toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFileName(template.id)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  function startPrint() {
    // New key each time so the <img> remounts and onLoad fires even if the image is unchanged.
    setPrint((p) => ({ url: render().toDataURL('image/png'), n: (p?.n ?? 0) + 1 }))
  }

  const printRoot = document.querySelector('.app')

  return (
    <section className="screen">
      <h2>{template.name}</h2>
      <div className="preview-wrap">
        <StampCanvas template={template} photo={capture} values={values} scale={PREVIEW_SCALE} label={`Your ${template.name.toLowerCase()}`} />
      </div>

      <div className="fields">
        {template.fields.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              value={values[f.key] ?? ''}
              maxLength={f.maxLength * 2 /* emoji are 2 UTF-16 units; the store clamps by code point */}
              onChange={(e) => setValue(f.key, e.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="row">
        <button className="btn primary" onClick={download}>Download PNG</button>
        <button className="btn primary" onClick={startPrint}>Print</button>
      </div>
      <div className="row">
        <button className="btn" onClick={retake}>Retake</button>
        <button className="btn" onClick={goToPicker}>Change template</button>
      </div>

      {print && printRoot &&
        createPortal(
          <div className="print-only">
            <img
              key={print.n}
              src={print.url}
              alt=""
              style={{ width: `${template.printSizeMm.w}mm`, height: `${template.printSizeMm.h}mm` }}
              onLoad={() => window.print()}
            />
          </div>,
          printRoot,
        )}
    </section>
  )
}
```

- [ ] **Step 2: Wire into `src/App.tsx`** — replace the editor placeholder with `{screen === 'editor' && <Editor />}` and add `import { Editor } from './screens/Editor'`. The print container is portalled into `.app` so the `@media print` rule `.app > *:not(.print-only)` hides everything else.

- [ ] **Step 3: Verify in the browser** (Chrome, then Safari if available)

Expected:
1. Capture each of Stamp, Voucher, Ticket → editor shows the captured pixel image in the frame.
2. Typing in fields updates the preview live; lowercase shows as uppercase; pasting 100 characters is clamped; emoji renders as `?` without errors.
3. Download PNG → file `pixel-booth-<id>-<timestamp>.png`; open it: dimensions = template size × 8 (stamp 768×960, voucher 1536×768, ticket 1536×640); edges crisp, no blur.
4. Print → print dialog shows only the stamp at the physical size (stamp 48×60mm); clicking Print a second time without edits opens the dialog again.
5. Ticket: Retake → new capture → serial changes, event name you typed stays.
6. Change template → pick the same template → your edits are still there.
7. Upload a portrait photo on the Ticket template → cropped, not stretched.

Run: `npm test && npm run build && npm run lint` → Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Editor.tsx src/App.tsx
git commit -m "feat: add editor with live fields, PNG download, and print"
```

---

### Task 11: README and final verification

**Files:**
- Modify: `README.md` (replace create-vite boilerplate)

- [ ] **Step 1: Write `README.md`**

````markdown
# Pixel Booth

A browser photobooth that turns your webcam photo into a pixel-art **stamp**, **voucher**, or **ticket** — download it as a PNG or print it.

Everything runs in the browser. Photos never leave the device.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
```

The camera needs HTTPS (localhost is fine for development).

## Deploy

Serve `dist/` from any static host (nginx, Dokploy static app, GitHub Pages) over HTTPS. No environment variables.

## Add a template

1. Create `src/templates/<name>.ts` exporting a `Template` (see `src/templates/types.ts`). Draw at art-pixel scale with the helpers in `draw.ts` and `pixelFont.ts`. Keep `photoRect` width/height divisible by 12.
2. Add it to the list in `src/templates/registry.ts`.
3. `npm test` — the contract test in `templates.test.ts` checks it automatically.
````

- [ ] **Step 2: Full verification**

Run: `npm test && npm run build && npm run lint && git status`
Expected: all tests pass, build succeeds, lint clean, only `README.md` modified.

Run: `npm run preview`, open the URL, repeat Task 10 Step 3 items 1, 3, 4 against the production build.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with run, deploy, and template guide"
```
