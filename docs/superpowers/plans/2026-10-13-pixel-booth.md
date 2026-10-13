# Pixel Booth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static browser photobooth that places an untouched webcam (or uploaded) photo inside a Balatro-inspired pixel-art stamp, voucher, or ticket, downloadable as PNG or printable.

**Architecture:** Vite + React + TypeScript SPA, no backend. Template modules (`src/templates`) draw only the frame and text at "art pixel" scale with a built-in bitmap font. One composer (`src/render/composeStamp`) upscales that art with smoothing off, then draws the photo into the photo slot at full output resolution with smoothing on. A Zustand store drives three screens (Picker → Booth → Editor) over a WebGL swirl background.

**Tech Stack:** Node 24 LTS, Vite 8.3, React 19.2 (pinned `~19.2.8`; 19.3.0 is one day old), TypeScript ~6.0 (what create-vite 9 scaffolds), Zustand 5, Vitest 4.1 (5.0 is ~6 weeks old), jsdom 30, vitest-canvas-mock 1.2, @testing-library/react 16, @fontsource/pixelify-sans 5.3.

**Spec:** `docs/superpowers/specs/2026-10-13-pixel-booth-design.md`

## Global Constraints

- The photo is never pixelated, recolored, or filtered. It is cover-cropped (never stretched) and drawn with `imageSmoothingQuality = 'high'`.
- Frame art is drawn in art pixels and upscaled only by integer `scale` with `imageSmoothingEnabled = false`.
- Preview scale: 4. Export (download/print) scale: 8. Captures are stored at `photoRect × 8`.
- Download filename: `pixel-booth-<templateId>-<timestamp>.png`.
- No network requests for photos; no storage; no analytics.
- Camera must be stopped whenever Booth unmounts, including when getUserMedia resolves after unmount.
- All motion (swirl, tilt, bob, pop) is disabled under `prefers-reduced-motion: reduce`.
- No Balatro assets, fonts, names, or card art — inspired-by only.
- Static build only; no env vars or secrets. Lockfile committed. Don't change dependency versions beyond those listed.
- Commit style: Conventional Commits. No AI attribution lines.

## Review Focus

1. **Leaving Booth while the permission prompt is still open** — getUserMedia resolves after unmount; the stream must be stopped immediately. Pinned in Task 7.
2. **Event-operator Retake** — edited fields (event name) survive Retake and re-selecting the same template; only per-capture fields (ticket serial) regenerate. Pinned in Task 6.
3. **Portrait or odd-aspect sources** (phone in portrait, tall upload) — cover-crop around the center, never stretch; mirrored captures stay mirrored consistently between preview and output. Pinned in Task 2.
4. **Lowercase, accents, emoji in fields** — render uppercase; unknown characters draw `?`; never throw. Pinned in Task 3 and the template contract test in Task 4.
5. **Pasting over-long text** — clamped to `maxLength` by code point (emoji not split). Pinned in Task 6.

---

## File Structure

```
pixel-booth/
  index.html                      Vite entry (title "Pixel Booth")
  vite.config.ts                  Vite + Vitest config
  src/
    main.tsx                      React root, font + CSS imports
    App.tsx                       Swirl background + screen switch
    index.css                     UI styles, motion, print styles
    test/setup.ts                 vitest-canvas-mock
    photo/
      crop.ts                     PhotoSource, coverCrop, drawCover, cropPhoto
      crop.test.ts
    templates/
      draw.ts                     Color, Rect, css, fill, outline, panel, drawBitmap, withDropShadow
      colors.ts                   shared Balatro-inspired palette
      pixelFont.ts                3×5 bitmap font with optional shadow
      pixelFont.test.ts
      types.ts                    TemplateField, Template
      fields.ts                   resolveDefaults, refreshPerCapture, clampValue
      stamp.ts / voucher.ts / ticket.ts
      ticket.test.ts
      registry.ts                 templates, getTemplate
      placeholder.ts              placeholderPhoto (smooth generated image)
      templates.test.ts           contract test over every template
    render/
      composeStamp.ts             frame (nearest) + photo (smooth)
      composeStamp.test.ts
      export.ts                   PREVIEW_SCALE, EXPORT_SCALE, exportFileName
      export.test.ts
    store/
      booth.ts / booth.test.ts
    camera/
      useCamera.ts / useCamera.test.ts
    ui/
      swirlShader.ts              GLSL sources + program helper
      SwirlBackground.tsx
      SwirlBackground.test.tsx
      TiltCard.tsx                tiltFor (pure) + component
      TiltCard.test.ts
    screens/
      StampCanvas.tsx
      TemplatePicker.tsx
      Booth.tsx
      Editor.tsx
```

---

### Task 1: Scaffold project and test harness

**Files:**
- Create: create-vite `react-ts` template files; modify `package.json`, `vite.config.ts`, `index.html`, `src/App.tsx`, `src/main.tsx`, `src/index.css`
- Create: `src/test/setup.ts`; temporary `src/smoke.test.ts`
- Delete: `src/App.css`, `src/assets/`, `public/vite.svg` (if present)

**Interfaces:**
- Produces: `npm test` (vitest run, jsdom + canvas mock), `npm run build`, `npm run lint`.

- [ ] **Step 1: Scaffold into a temp dir and copy in** (the repo already contains `docs/`)

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
npm install react@~19.2.8 react-dom@~19.2.8 zustand@5.0.15 @fontsource/pixelify-sans@5.3.0
npm install -D vitest@4.1.11 jsdom@30.1.2 vitest-canvas-mock@1.2.0 @testing-library/react@16.3.3 @testing-library/dom@10.4.2
```

- [ ] **Step 3: `package.json`** — set `"name": "pixel-booth"` and add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

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

- [ ] **Step 6: Minimal shell.** `src/App.tsx`:

```tsx
export default function App() {
  return <main className="app"><h1 className="logo">PIXEL BOOTH</h1></main>
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/index.css`: replace contents with `body { margin: 0; }` (styled in Task 9). In `index.html` set `<title>Pixel Booth</title>` and remove the vite.svg favicon `<link>`.

- [ ] **Step 7: Smoke test.** `src/smoke.test.ts`:

```ts
import { expect, test } from 'vitest'

test('canvas mock and ImageData are available', () => {
  const ctx = document.createElement('canvas').getContext('2d')
  expect(ctx).not.toBeNull()
  expect(new ImageData(2, 3).data.length).toBe(24)
})
```

Run: `npm test` → Expected: 1 passed. Run: `npm run build && npm run lint` → Expected: both succeed.

- [ ] **Step 8: Remove smoke test and commit**

```bash
rm src/smoke.test.ts
git add -A
git commit -m "chore: scaffold vite react-ts app with vitest harness"
```

---

### Task 2: Photo cropping

**Files:**
- Create: `src/photo/crop.ts`, `src/photo/crop.test.ts`

**Interfaces:**
- Produces:
  - `interface PhotoSource { source: CanvasImageSource; w: number; h: number; mirror?: boolean }`
  - `coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number }`
  - `drawCover(ctx: CanvasRenderingContext2D, photo: PhotoSource, dx: number, dy: number, dw: number, dh: number): void` — smooth, high quality, mirrored if `photo.mirror`; restores ctx state
  - `cropPhoto(photo: PhotoSource, width: number, height: number): PhotoSource` — returns `{ source: <new canvas>, w: width, h: height }` with mirroring baked in (no `mirror` flag)

- [ ] **Step 1: Write failing tests** `src/photo/crop.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'
import { coverCrop, cropPhoto, drawCover } from './crop'

describe('coverCrop', () => {
  test('same aspect uses the whole source', () => {
    expect(coverCrop(640, 480, 64, 48)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 480 })
  })
  test('landscape source into portrait target crops the sides, centered', () => {
    const c = coverCrop(1280, 720, 72, 84)
    expect(c.sy).toBe(0)
    expect(c.sh).toBe(720)
    expect(c.sw).toBeCloseTo(617.14, 2)
    expect(c.sx).toBeCloseTo(331.43, 2)
  })
  test('portrait source into landscape target crops top and bottom, centered', () => {
    expect(coverCrop(720, 1280, 60, 30)).toEqual({ sx: 0, sy: 460, sw: 720, sh: 360 })
  })
  test('the cropped region keeps the target aspect (never stretches)', () => {
    const c = coverCrop(1000, 333, 72, 84)
    expect(c.sw / c.sh).toBeCloseTo(72 / 84, 6)
  })
})

describe('drawCover', () => {
  test('mirrors around the destination rect and restores state', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const save = vi.spyOn(ctx, 'save')
    const restore = vi.spyOn(ctx, 'restore')
    const translate = vi.spyOn(ctx, 'translate')
    const scale = vi.spyOn(ctx, 'scale')
    const src = document.createElement('canvas')
    drawCover(ctx, { source: src, w: 100, h: 100, mirror: true }, 10, 20, 30, 30)
    expect(translate).toHaveBeenCalledWith(50, 0)
    expect(scale).toHaveBeenCalledWith(-1, 1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(restore).toHaveBeenCalledTimes(1)
  })
  test('does not mirror when mirror is unset', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const scale = vi.spyOn(ctx, 'scale')
    drawCover(ctx, { source: document.createElement('canvas'), w: 10, h: 10 }, 0, 0, 10, 10)
    expect(scale).not.toHaveBeenCalled()
  })
})

describe('cropPhoto', () => {
  test('returns an unmirrored PhotoSource of the requested size', () => {
    const src = document.createElement('canvas')
    const out = cropPhoto({ source: src, w: 1280, h: 720, mirror: true }, 576, 672)
    expect(out.w).toBe(576)
    expect(out.h).toBe(672)
    expect(out.mirror).toBeUndefined()
    const canvas = out.source as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([576, 672])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/photo` → Expected: FAIL, cannot resolve `./crop`.

- [ ] **Step 3: Implement `src/photo/crop.ts`**

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/photo` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/photo
git commit -m "feat: add cover-crop photo helpers with mirroring"
```

---

### Task 3: Draw helpers, palette, and bitmap font

**Files:**
- Create: `src/templates/draw.ts`, `src/templates/colors.ts`, `src/templates/pixelFont.ts`, `src/templates/pixelFont.test.ts`

**Interfaces:**
- Produces (`draw.ts`):
  - `type Color = readonly [number, number, number] | readonly [number, number, number, number]` (4th = alpha 0–1)
  - `interface Rect { x: number; y: number; w: number; h: number }`
  - `css(c: Color): string`
  - `fill(ctx, color: Color, x, y, w, h): void`
  - `outline(ctx, color: Color, x, y, w, h): void` — 1px border inside the box
  - `panel(ctx, color: Color, x, y, w, h, r?: number): void` — filled rect with stepped pixel corners of radius `r` (default 2)
  - `drawBitmap(ctx, rows: readonly string[], x, y, color: Color, scale?: number): void`
  - `withDropShadow(ctx, w: number, h: number, offset: number, color: Color, drawBody: (ctx: CanvasRenderingContext2D) => void): void` — draws the body's exact silhouette offset by `offset` in `color`, then the body on top
- Produces (`colors.ts`): `OUTLINE, SHADOW, CREAM, RED, RED_DARK, BLUE, BLUE_DARK, GOLD, GOLD_DARK: Color`
- Produces (`pixelFont.ts`):
  - `GLYPHS: Record<string, readonly string[]>`
  - `glyphFor(ch: string): readonly string[]` — case-insensitive; unknown → `?` glyph
  - `measureText(text: string, scale?: number): number` — excludes shadow
  - `fitScale(text: string, maxWidth: number, maxScale: number): number`
  - `drawText(ctx, text, x, y, color: Color, scale?: number, shadow?: Color): void` — shadow drawn at `+scale, +scale`
  - `drawTextCentered(ctx, text, centerX, y, color: Color, scale?: number, shadow?: Color): void`
  - `drawTextRight(ctx, text, right, y, color: Color, scale?: number, shadow?: Color): void`

- [ ] **Step 1: Write failing tests** `src/templates/pixelFont.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'
import { panel, withDropShadow } from './draw'
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
    expect(fitScale('HI', 20, 2)).toBe(2)
    expect(fitScale('HELLO', 20, 2)).toBe(1)
    expect(fitScale('WAY TOO LONG TEXT', 10, 2)).toBe(1)
  })
})

describe('drawText', () => {
  test('does not throw on lowercase, accents, emoji, empty text, or with a shadow', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    expect(() => drawText(ctx, 'héllo 😀 wörld', 0, 0, [0, 0, 0])).not.toThrow()
    expect(() => drawText(ctx, '', 0, 0, [0, 0, 0], 2)).not.toThrow()
    expect(() => drawText(ctx, 'HI', 0, 0, [255, 255, 255], 2, [0, 0, 0, 0.5])).not.toThrow()
  })
  test('shadow draws each lit glyph pixel twice', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    const fillRect = vi.spyOn(ctx, 'fillRect')
    drawText(ctx, 'I', 0, 0, [255, 255, 255])
    const plain = fillRect.mock.calls.length
    fillRect.mockClear()
    drawText(ctx, 'I', 0, 0, [255, 255, 255], 1, [0, 0, 0])
    expect(fillRect.mock.calls.length).toBe(plain * 2)
  })
})

describe('draw helpers', () => {
  test('panel and withDropShadow do not throw', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    expect(() => panel(ctx, [1, 2, 3], 0, 0, 20, 10, 3)).not.toThrow()
    expect(() => withDropShadow(ctx, 20, 10, 2, [0, 0, 0, 0.4], (c) => panel(c, [9, 9, 9], 0, 0, 20, 10))).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/templates/pixelFont.test.ts` → Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `src/templates/draw.ts`**

```ts
export type Color = readonly [number, number, number] | readonly [number, number, number, number]

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const css = (c: Color) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${c[3] ?? 1})`

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
```

- [ ] **Step 4: Implement `src/templates/colors.ts`** (our own palette, inspired by the mood, not sampled from the game)

```ts
import type { Color } from './draw'

export const OUTLINE: Color = [28, 30, 44]
export const SHADOW: Color = [0, 0, 0, 0.45]
export const CREAM: Color = [246, 236, 214]
export const RED: Color = [229, 72, 77]
export const RED_DARK: Color = [168, 44, 58]
export const BLUE: Color = [0, 145, 230]
export const BLUE_DARK: Color = [0, 98, 168]
export const GOLD: Color = [245, 177, 66]
export const GOLD_DARK: Color = [196, 122, 30]
```

- [ ] **Step 5: Implement `src/templates/pixelFont.ts`**

```ts
import { drawBitmap, type Color } from './draw'

const ADVANCE = 4 // 3px glyph + 1px gap

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

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: Color,
  scale = 1,
  shadow?: Color,
) {
  const glyphs = chars(text).map(glyphFor)
  if (shadow) glyphs.forEach((g, i) => drawBitmap(ctx, g, x + i * ADVANCE * scale + scale, y + scale, shadow, scale))
  glyphs.forEach((g, i) => drawBitmap(ctx, g, x + i * ADVANCE * scale, y, color, scale))
}

export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  color: Color,
  scale = 1,
  shadow?: Color,
) {
  drawText(ctx, text, Math.round(centerX - measureText(text, scale) / 2), y, color, scale, shadow)
}

export function drawTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  right: number,
  y: number,
  color: Color,
  scale = 1,
  shadow?: Color,
) {
  drawText(ctx, text, right - measureText(text, scale), y, color, scale, shadow)
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/templates/pixelFont.test.ts` → Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/templates/draw.ts src/templates/colors.ts src/templates/pixelFont.ts src/templates/pixelFont.test.ts
git commit -m "feat: add pixel draw helpers, palette, and 3x5 bitmap font"
```

---

### Task 4: Template contract, composer, Stamp, registry

**Files:**
- Create: `src/templates/types.ts`, `src/templates/fields.ts`, `src/templates/stamp.ts`, `src/templates/registry.ts`, `src/templates/placeholder.ts`, `src/templates/templates.test.ts`
- Create: `src/render/composeStamp.ts`, `src/render/composeStamp.test.ts`, `src/render/export.ts`, `src/render/export.test.ts`

**Interfaces:**
- Consumes: `PhotoSource`, `drawCover` (Task 2); `Rect`, `fill`, `outline`, `panel`, `withDropShadow`, colors, `drawText*` (Task 3)
- Produces:
  - `types.ts`: `TemplateField { key; label; default: string | (() => string); maxLength: number; perCapture?: boolean }`; `Template { id; name; size: { w; h }; photoRect: Rect; fields: readonly TemplateField[]; printSizeMm: { w; h }; render(ctx, values: Record<string, string>): void }`; re-exports `Rect`
  - `fields.ts`: `resolveDefaults(t)`, `refreshPerCapture(t, values)`, `clampValue(field, value)`
  - `registry.ts`: `templates: readonly Template[]`, `getTemplate(id): Template` (throws `Unknown template: <id>`)
  - `placeholder.ts`: `placeholderPhoto(t: Template): PhotoSource`
  - `composeStamp(template, photo: PhotoSource, values, scale: number, target?: HTMLCanvasElement): HTMLCanvasElement`
  - `export.ts`: `PREVIEW_SCALE = 4`, `EXPORT_SCALE = 8`, `exportFileName(templateId, now?: Date): string`

- [ ] **Step 1: Write failing tests.** `src/templates/templates.test.ts` (runs over every registered template, so Task 5's templates are covered automatically):

```ts
import { describe, expect, test } from 'vitest'
import { clampValue, refreshPerCapture, resolveDefaults } from './fields'
import { placeholderPhoto } from './placeholder'
import { getTemplate, templates } from './registry'

describe.each(templates.map((t) => [t.id, t] as const))('template %s', (_id, t) => {
  test('photoRect lies inside the template', () => {
    const r = t.photoRect
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(t.size.w)
    expect(r.y + r.h).toBeLessThanOrEqual(t.size.h)
  })

  test('field keys are unique and defaults fit maxLength', () => {
    const keys = t.fields.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
    const defaults = resolveDefaults(t)
    for (const f of t.fields) {
      expect(Array.from(defaults[f.key]).length, f.key).toBeLessThanOrEqual(f.maxLength)
    }
  })

  test('renders with defaults, max-length junk, and empty values without throwing', () => {
    const ctx = document.createElement('canvas').getContext('2d')!
    expect(() => t.render(ctx, resolveDefaults(t))).not.toThrow()
    const junk = Object.fromEntries(t.fields.map((f) => [f.key, 'é😀w'.repeat(f.maxLength).slice(0, f.maxLength)]))
    expect(() => t.render(ctx, junk)).not.toThrow()
    expect(() => t.render(ctx, {})).not.toThrow()
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
})

describe('fields', () => {
  test('clampValue limits by code points, not UTF-16 units', () => {
    const f = { key: 'k', label: 'K', default: '', maxLength: 3 }
    expect(clampValue(f, 'ABCDEF')).toBe('ABC')
    expect(clampValue(f, '😀😀😀😀')).toBe('😀😀😀')
  })
  test('refreshPerCapture keeps non-per-capture values', () => {
    const t = getTemplate('stamp')
    expect(refreshPerCapture(t, { ...resolveDefaults(t), title: 'MY EVENT' }).title).toBe('MY EVENT')
  })
})

describe('placeholderPhoto', () => {
  test('is photoRect × 4 and unmirrored', () => {
    const t = getTemplate('stamp')
    const p = placeholderPhoto(t)
    expect([p.w, p.h]).toEqual([t.photoRect.w * 4, t.photoRect.h * 4])
    expect(p.mirror).toBeUndefined()
  })
})
```

`src/render/composeStamp.test.ts`:

```ts
import { expect, test, vi } from 'vitest'
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

test('draws the photo into photoRect × scale', () => {
  const target = document.createElement('canvas')
  const ctx = target.getContext('2d')!
  const drawImage = vi.spyOn(ctx, 'drawImage')
  composeStamp(t, photo, resolveDefaults(t), 8, target)
  const r = t.photoRect
  const photoCall = drawImage.mock.calls.find((c) => c[0] === photo.source)
  expect(photoCall?.slice(5)).toEqual([r.x * 8, r.y * 8, r.w * 8, r.h * 8])
})

test('draws into and returns a provided target canvas', () => {
  const target = document.createElement('canvas')
  expect(composeStamp(t, photo, resolveDefaults(t), 2, target)).toBe(target)
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
  expect(exportFileName('ticket', new Date('2026-10-13T09:05:07.123Z'))).toBe(
    'pixel-booth-ticket-2026-10-13T09-05-07-123Z.png',
  )
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/templates/templates.test.ts src/render` → Expected: FAIL, missing modules.

Note: the "draws the photo into photoRect × scale" test assumes `getContext('2d')` returns the same object on repeated calls for one canvas. If the canvas mock returns a fresh object, spy on `CanvasRenderingContext2D.prototype.drawImage` instead (and `mockRestore()` it after) — same assertion.

- [ ] **Step 3: Implement `src/templates/types.ts`**

```ts
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
  /** Art pixels, including drop-shadow margin. */
  size: { w: number; h: number }
  /** Art pixels. The composer draws the photo here; render() must not. */
  photoRect: Rect
  fields: readonly TemplateField[]
  printSizeMm: { w: number; h: number }
  /** Draws frame and text at art scale. Must tolerate missing values. */
  render(ctx: CanvasRenderingContext2D, values: Record<string, string>): void
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

Body is 96×120 art px; drop shadow offset 3 → size 99×123. Deep-red stamp with perforated edge, cream mat around the photo, gold value badge.

```ts
import { CREAM, GOLD, OUTLINE, RED, RED_DARK, SHADOW } from './colors'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawText, drawTextCentered } from './pixelFont'
import type { Template } from './types'

const BW = 96
const BH = 120
const SHADOW_OFFSET = 3
const PHOTO = { x: 12, y: 12, w: 72, h: 84 }

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  fill(ctx, OUTLINE, 0, 0, BW, BH)
  fill(ctx, RED, 1, 1, BW - 2, BH - 2)

  // Perforated edge: a notch every 6px on all four sides.
  for (let x = 1; x + 4 <= BW; x += 6) {
    ctx.clearRect(x, 0, 4, 2)
    ctx.clearRect(x + 1, 2, 2, 1)
    ctx.clearRect(x, BH - 2, 4, 2)
    ctx.clearRect(x + 1, BH - 3, 2, 1)
  }
  for (let y = 1; y + 4 <= BH; y += 6) {
    ctx.clearRect(0, y, 2, 4)
    ctx.clearRect(2, y + 1, 1, 2)
    ctx.clearRect(BW - 2, y, 2, 4)
    ctx.clearRect(BW - 3, y + 1, 1, 2)
  }

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  drawTextCentered(ctx, values.title ?? '', BW / 2, 101, CREAM, 1, RED_DARK)
  drawText(ctx, 'PIXEL POST', 8, 110, GOLD, 1, RED_DARK)

  // Gold value badge, bottom right.
  panel(ctx, OUTLINE, 64, 107, 25, 10, 2)
  panel(ctx, GOLD, 65, 108, 23, 8, 1)
  drawTextCentered(ctx, values.value ?? '', 76, 110, OUTLINE)
}

export const stamp: Template = {
  id: 'stamp',
  name: 'Stamp',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 50, h: 62 },
  fields: [
    { key: 'title', label: 'Title', default: 'FIRST STAMP', maxLength: 14 },
    { key: 'value', label: 'Value', default: '25¢', maxLength: 5 },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
```

Layout check: title 14 chars = 55px centered at 48 → 21..76, inside the red border. "PIXEL POST" (39px) from x=8 ends at 47 < badge at 64. Value 5 chars = 19px centered at 76 → 67..85 inside the 65..87 badge.

- [ ] **Step 6: Implement `src/templates/registry.ts`** (Task 5 adds voucher and ticket)

```ts
import { stamp } from './stamp'
import type { Template } from './types'

export const templates: readonly Template[] = [stamp]

export function getTemplate(id: string): Template {
  const t = templates.find((t) => t.id === id)
  if (!t) throw new Error(`Unknown template: ${id}`)
  return t
}
```

- [ ] **Step 7: Implement `src/templates/placeholder.ts`** — a smooth smiley used by the picker and the idle booth

```ts
import type { PhotoSource } from '../photo/crop'
import { BLUE, GOLD, OUTLINE, RED } from './colors'
import { css } from './draw'
import type { Template } from './types'

const SCALE = 4

export function placeholderPhoto(t: Template): PhotoSource {
  const w = t.photoRect.w * SCALE
  const h = t.photoRect.h * SCALE
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, css(BLUE))
  bg.addColorStop(1, css(RED))
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const r = Math.min(w, h) * 0.32
  const cx = w / 2
  const cy = h / 2
  ctx.fillStyle = css(GOLD)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = css(OUTLINE)
  for (const ex of [cx - r * 0.38, cx + r * 0.38]) {
    ctx.beginPath()
    ctx.arc(ex, cy - r * 0.22, r * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = css(OUTLINE)
  ctx.lineWidth = r * 0.1
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy + r * 0.05, r * 0.5, Math.PI * 0.2, Math.PI * 0.8)
  ctx.stroke()

  return { source: canvas, w, h }
}
```

- [ ] **Step 8: Implement `src/render/composeStamp.ts`**

```ts
import { drawCover, type PhotoSource } from '../photo/crop'
import type { Template } from '../templates/types'

/**
 * Frame art is drawn at art scale and upscaled with no smoothing (crisp pixels);
 * the photo is then drawn into photoRect × scale with high-quality smoothing.
 * Shared by preview, download, and print so all three match.
 */
export function composeStamp(
  template: Template,
  photo: PhotoSource,
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
  template.render(art.getContext('2d')!, values)

  const out = target ?? document.createElement('canvas')
  if (out.width !== w * scale) out.width = w * scale
  if (out.height !== h * scale) out.height = h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, out.width, out.height)
  ctx.drawImage(art, 0, 0, out.width, out.height)

  const r = template.photoRect
  drawCover(ctx, photo, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
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
- Modify: `src/templates/registry.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–4
- Produces: `voucher: Template` (id `'voucher'`), `ticket: Template` (id `'ticket'`), `todayIso(now?: Date): string`, `randomSerial(rand?: () => number): string`

- [ ] **Step 1: Write failing tests** `src/templates/ticket.test.ts`:

```ts
import { expect, test } from 'vitest'
import { refreshPerCapture, resolveDefaults } from './fields'
import { getTemplate, templates } from './registry'
import { randomSerial, todayIso } from './ticket'

test('todayIso uses the local date as YYYY-MM-DD', () => {
  expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
})

test('randomSerial is "NO. " + 6 zero-padded digits', () => {
  expect(randomSerial(() => 0)).toBe('NO. 000000')
  expect(randomSerial(() => 0.000123)).toBe('NO. 000123')
  expect(randomSerial(() => 0.9999999)).toBe('NO. 999999')
})

test('ticket serial regenerates per capture; event name is kept', () => {
  const t = getTemplate('ticket')
  const next = refreshPerCapture(t, { ...resolveDefaults(t), event: 'GRAD NIGHT', serial: 'NO. 111111' })
  expect(next.event).toBe('GRAD NIGHT')
  expect(next.serial).toMatch(/^NO\. \d{6}$/)
})

test('registry lists stamp, voucher, ticket in order', () => {
  expect(templates.map((t) => t.id)).toEqual(['stamp', 'voucher', 'ticket'])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/templates` → Expected: FAIL, cannot resolve `./ticket`.

- [ ] **Step 3: Implement `src/templates/voucher.ts`**

Body 188×92 (+3 shadow). Teal-blue card with stepped corners, cream mat around the photo, gold amount plate, dashed cut line, "KEEP ♥ THIS" stub.

```ts
import { BLUE, BLUE_DARK, CREAM, GOLD, OUTLINE, RED, SHADOW } from './colors'
import { drawBitmap, fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered, fitScale } from './pixelFont'
import type { Template } from './types'

const BW = 188
const BH = 92
const SHADOW_OFFSET = 3
const PHOTO = { x: 6, y: 6, w: 72, h: 80 }
const CUT = 146
const TEXT_CX = 113 // center of the 84..142 text column
const STUB_CX = 167

const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000']

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, BLUE, 1, 1, BW - 2, BH - 2, 2)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  // Dashed cut line with notches top and bottom.
  for (let y = 6; y < BH - 6; y += 5) fill(ctx, CREAM, CUT, y, 1, 3)
  ctx.clearRect(CUT - 2, 0, 5, 2)
  ctx.clearRect(CUT - 1, 2, 3, 1)
  ctx.clearRect(CUT - 2, BH - 2, 5, 2)
  ctx.clearRect(CUT - 1, BH - 3, 3, 1)

  const title = values.title ?? ''
  const ts = fitScale(title, 58, 2)
  drawTextCentered(ctx, title, TEXT_CX, ts === 2 ? 8 : 10, CREAM, ts, BLUE_DARK)

  panel(ctx, OUTLINE, 84, 30, 58, 24, 2)
  panel(ctx, GOLD, 85, 31, 56, 22, 1)
  const amount = values.amount ?? ''
  const as = fitScale(amount, 52, 2)
  drawTextCentered(ctx, amount, TEXT_CX, as === 2 ? 37 : 40, OUTLINE, as)

  drawTextCentered(ctx, values.expires ?? '', TEXT_CX, 62, CREAM, 1, BLUE_DARK)
  drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 76, GOLD, 1, BLUE_DARK)

  drawTextCentered(ctx, 'KEEP', STUB_CX, 26, CREAM, 1, BLUE_DARK)
  drawBitmap(ctx, HEART, STUB_CX - 3, 39, RED)
  drawTextCentered(ctx, 'THIS', STUB_CX, 54, CREAM, 1, BLUE_DARK)
}

export const voucher: Template = {
  id: 'voucher',
  name: 'Voucher',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 120, h: 60 },
  fields: [
    { key: 'title', label: 'Title', default: 'VOUCHER', maxLength: 14 },
    { key: 'amount', label: 'Amount', default: 'FREE HUG', maxLength: 12 },
    { key: 'expires', label: 'Expires', default: 'VALID TODAY', maxLength: 14 },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
```

- [ ] **Step 4: Implement `src/templates/ticket.ts`**

Body 188×76 (+3 shadow). Gold ticket with side notches, red event plate, perforated stub with serial.

```ts
import { CREAM, GOLD, GOLD_DARK, OUTLINE, RED, RED_DARK, SHADOW } from './colors'
import { fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered, fitScale } from './pixelFont'
import type { Template } from './types'

const BW = 188
const BH = 76
const SHADOW_OFFSET = 3
const PHOTO = { x: 8, y: 6, w: 60, h: 64 }
const STUB = 148
const TEXT_CX = 109
const STUB_CX = 168

const pad = (n: number, len: number) => String(n).padStart(len, '0')

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`
}

export function randomSerial(rand: () => number = Math.random): string {
  return `NO. ${pad(Math.floor(rand() * 1_000_000), 6)}`
}

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, GOLD, 1, 1, BW - 2, BH - 2, 2)

  // Side notches and stub notches.
  ctx.clearRect(0, 32, 2, 12)
  ctx.clearRect(2, 34, 1, 8)
  ctx.clearRect(BW - 2, 32, 2, 12)
  ctx.clearRect(BW - 3, 34, 1, 8)
  ctx.clearRect(STUB - 2, 0, 5, 2)
  ctx.clearRect(STUB - 1, 2, 3, 1)
  ctx.clearRect(STUB - 2, BH - 2, 5, 2)
  ctx.clearRect(STUB - 1, BH - 3, 3, 1)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  for (let y = 4; y < BH - 4; y += 4) fill(ctx, OUTLINE, STUB, y, 1, 2)

  drawTextCentered(ctx, 'ADMIT ONE', TEXT_CX, 6, CREAM, 2, GOLD_DARK)

  panel(ctx, OUTLINE, 74, 22, 70, 22, 2)
  panel(ctx, RED, 75, 23, 68, 20, 1)
  const event = values.event ?? ''
  const s = fitScale(event, 64, 2)
  drawTextCentered(ctx, event, TEXT_CX, s === 2 ? 28 : 31, CREAM, s, RED_DARK)

  drawTextCentered(ctx, values.date ?? '', TEXT_CX, 50, OUTLINE)
  drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 62, RED_DARK)

  drawTextCentered(ctx, 'ADMIT', STUB_CX, 8, OUTLINE)
  drawTextCentered(ctx, 'ONE', STUB_CX, 16, OUTLINE)
  const lines = (values.serial ?? '').split(' ').filter(Boolean).slice(0, 3)
  lines.forEach((line, i) => drawTextCentered(ctx, line.slice(0, 9), STUB_CX, 34 + i * 8, OUTLINE))
}

export const ticket: Template = {
  id: 'ticket',
  name: 'Ticket',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 144, h: 60 },
  fields: [
    { key: 'event', label: 'Event', default: 'PIXEL PARTY', maxLength: 14 },
    { key: 'date', label: 'Date', default: () => todayIso(), maxLength: 10 },
    { key: 'serial', label: 'Serial', default: () => randomSerial(), maxLength: 10, perCapture: true },
  ],
  render(ctx, values) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, (c) => body(c, values))
  },
}
```

- [ ] **Step 5: Register them** — `src/templates/registry.ts` imports and list become:

```ts
import { stamp } from './stamp'
import { ticket } from './ticket'
import type { Template } from './types'
import { voucher } from './voucher'

export const templates: readonly Template[] = [stamp, voucher, ticket]
```

(`getTemplate` unchanged.)

- [ ] **Step 6: Run tests**

Run: `npm test` → Expected: all pass, including the contract test for voucher and ticket.

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
- Consumes: `getTemplate`, `resolveDefaults`, `refreshPerCapture`, `clampValue`, `PhotoSource`
- Produces: `type Screen = 'picker' | 'booth' | 'editor'`; `useBooth` with state `{ screen, templateId, capture: PhotoSource | null, values: Record<string, string> }` and actions `selectTemplate(id)`, `setCapture(photo: PhotoSource)`, `retake()`, `goToPicker()`, `setValue(key, value)`

- [ ] **Step 1: Write failing tests** `src/store/booth.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest'
import type { PhotoSource } from '../photo/crop'
import { useBooth } from './booth'

const s = () => useBooth.getState()
const photo = (): PhotoSource => ({ source: document.createElement('canvas'), w: 10, h: 10 })

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
    const p = photo()
    s().setCapture(p)
    expect(s().capture).toBe(p)
    expect(s().screen).toBe('editor')
    expect(s().values.event).toBe('GRAD NIGHT')
    expect(s().values.serial).toMatch(/^NO\. \d{6}$/)
  })

  test('retake clears the capture, keeps values, returns to the booth', () => {
    s().selectTemplate('stamp')
    s().setValue('title', 'HELLO')
    s().setCapture(photo())
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
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store` → Expected: FAIL, cannot resolve `./booth`.

- [ ] **Step 3: Implement `src/store/booth.ts`**

```ts
import { create } from 'zustand'
import type { PhotoSource } from '../photo/crop'
import { clampValue, refreshPerCapture, resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'

export type Screen = 'picker' | 'booth' | 'editor'

interface BoothState {
  screen: Screen
  templateId: string
  capture: PhotoSource | null
  values: Record<string, string>
  selectTemplate(id: string): void
  setCapture(photo: PhotoSource): void
  retake(): void
  goToPicker(): void
  setValue(key: string, value: string): void
}

export const useBooth = create<BoothState>()((set, get) => ({
  screen: 'picker',
  templateId: 'stamp',
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
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
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

(Ideal resolution is 1080p since the photo is now shown at full quality; browsers fall back to what the camera supports.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/camera` → Expected: all 6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/camera
git commit -m "feat: add useCamera hook that releases late-arriving streams"
```

---

### Task 8: Swirl background and tilt cards

**Files:**
- Create: `src/ui/swirlShader.ts`, `src/ui/SwirlBackground.tsx`, `src/ui/SwirlBackground.test.tsx`, `src/ui/TiltCard.tsx`, `src/ui/TiltCard.test.ts`

**Interfaces:**
- Produces:
  - `<SwirlBackground />` — fixed full-screen `<canvas class="swirl">`; WebGL swirl; CSS gradient shows when WebGL is unavailable
  - `tiltFor(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, max: number): { rx: number; ry: number }`
  - `<TiltCard delay?: number>{children}</TiltCard>` — sets `--rx`/`--ry` CSS vars on pointer move; `.tilt` / `.tilt-inner` classes styled in Task 9

- [ ] **Step 1: Write failing tests.** `src/ui/TiltCard.test.ts`:

```ts
import { expect, test } from 'vitest'
import { tiltFor } from './TiltCard'

const rect = { left: 100, top: 50, width: 200, height: 100 }

test('center is flat', () => {
  expect(tiltFor(200, 100, rect, 10)).toEqual({ rx: 0, ry: 0 })
})

test('right edge tilts +max around Y, top edge tilts +max around X', () => {
  expect(tiltFor(300, 100, rect, 10).ry).toBe(10)
  expect(tiltFor(200, 50, rect, 10).rx).toBe(10)
})

test('clamps when the pointer is outside the card', () => {
  expect(tiltFor(1000, 1000, rect, 10)).toEqual({ rx: -10, ry: 10 })
})
```

`src/ui/SwirlBackground.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SwirlBackground } from './SwirlBackground'

test('renders a decorative canvas and survives missing WebGL', () => {
  const { container } = render(<SwirlBackground />)
  const canvas = container.querySelector('canvas.swirl')
  expect(canvas).not.toBeNull()
  expect(canvas?.getAttribute('aria-hidden')).toBe('true')
})
```

(jsdom + canvas mock returns `null` for `getContext('webgl')`, which exercises the fallback path. If the mock returns an object instead, the test still only asserts the component renders.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui` → Expected: FAIL, missing modules.

- [ ] **Step 3: Implement `src/ui/TiltCard.tsx`**

```tsx
import { useRef, type PointerEvent, type ReactNode } from 'react'

const MAX_TILT = 10
const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v))

export function tiltFor(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  max: number,
) {
  const px = clamp((clientX - rect.left) / rect.width - 0.5)
  const py = clamp((clientY - rect.top) / rect.height - 0.5)
  return { rx: -py * 2 * max + 0, ry: px * 2 * max + 0 }
}

export function TiltCard({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const { rx, ry } = tiltFor(e.clientX, e.clientY, el.getBoundingClientRect(), MAX_TILT)
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
  }

  function onLeave() {
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }

  return (
    <div ref={ref} className="tilt" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="tilt-inner" style={{ animationDelay: `${delay}s` }}>
        {children}
      </div>
    </div>
  )
}
```

(The `+ 0` turns `-0` into `0` so `toEqual({ rx: 0, ry: 0 })` passes.)

- [ ] **Step 4: Implement `src/ui/swirlShader.ts`**

```ts
export const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

// Our own swirl: polar twist + layered sine warps, posterized for a pixel-art feel.
export const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float r = length(uv);
  float a = atan(uv.y, uv.x) + r * 2.6 - u_time * 0.12;
  vec2 p = vec2(cos(a), sin(a)) * r * 3.0;
  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    p += vec2(0.6 / fi * sin(fi * p.y + u_time * 0.30 + 0.3 * fi),
              0.6 / fi * cos(fi * p.x + u_time * 0.25 + 0.3 * fi));
  }
  float t = 0.5 + 0.5 * sin(p.x + p.y);
  vec3 red = vec3(0.86, 0.26, 0.29);
  vec3 blue = vec3(0.00, 0.50, 0.84);
  vec3 dark = vec3(0.11, 0.11, 0.17);
  vec3 col = mix(red, blue, smoothstep(0.2, 0.8, t));
  col = mix(col, dark, 0.65 * smoothstep(0.5, 1.0, 0.5 + 0.5 * sin(p.x * 1.7 - p.y * 1.3)));
  col = floor(col * 8.0) / 8.0;
  gl_FragColor = vec4(col, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

export function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return null
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null
}
```

- [ ] **Step 5: Implement `src/ui/SwirlBackground.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { createProgram } from './swirlShader'

const PIXEL = 6 // CSS px per shader pixel; the canvas is upscaled with image-rendering: pixelated
const STILL_TIME = 20 // seconds; the frame shown when motion is reduced

export function SwirlBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas?.getContext('webgl', { antialias: false }) ?? null
    if (!canvas || !gl) return
    const program = createProgram(gl)
    if (!program) return

    gl.useProgram(program)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(program, 'u_res')
    const uTime = gl.getUniformLocation(program, 'u_time')

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const t0 = performance.now()
    let raf = 0

    const draw = (seconds: number) => {
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, seconds)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const loop = (now: number) => {
      draw((now - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    const run = () => {
      cancelAnimationFrame(raf)
      if (reduce.matches) draw(STILL_TIME)
      else if (!document.hidden) raf = requestAnimationFrame(loop)
    }
    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth / PIXEL)
      canvas.height = Math.ceil(window.innerHeight / PIXEL)
      gl.viewport(0, 0, canvas.width, canvas.height)
      run()
    }

    resize()
    canvas.dataset.ready = 'true'
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', run)
    reduce.addEventListener('change', run)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', run)
      reduce.removeEventListener('change', run)
    }
  }, [])

  return <canvas ref={ref} className="swirl" aria-hidden="true" />
}
```

Note: jsdom lacks `matchMedia`, but the effect returns before reaching it when WebGL is unavailable, so the test does not need a polyfill.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/ui` → Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui
git commit -m "feat: add swirl shader background and tilt card"
```

---

### Task 9: App shell, styles, and Template Picker

**Files:**
- Modify: `src/App.tsx`, `src/index.css`
- Create: `src/screens/StampCanvas.tsx`, `src/screens/TemplatePicker.tsx`

**Interfaces:**
- Consumes: `useBooth`, `templates`, `resolveDefaults`, `placeholderPhoto`, `composeStamp`, `SwirlBackground`, `TiltCard`
- Produces: `<StampCanvas template photo values scale label className? />` — canvas re-rendered with `composeStamp` when props change (Picker, Editor)

- [ ] **Step 1: Create `src/screens/StampCanvas.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import type { PhotoSource } from '../photo/crop'
import { composeStamp } from '../render/composeStamp'
import type { Template } from '../templates/types'

interface Props {
  template: Template
  photo: PhotoSource
  values: Record<string, string>
  scale: number
  label: string
  className?: string
}

export function StampCanvas({ template, photo, values, scale, label, className = '' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) composeStamp(template, photo, values, scale, ref.current)
  }, [template, photo, values, scale])
  return <canvas ref={ref} className={`stamp-canvas ${className}`} role="img" aria-label={label} />
}
```

- [ ] **Step 2: Create `src/screens/TemplatePicker.tsx`**

```tsx
import { useMemo } from 'react'
import { useBooth } from '../store/booth'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { templates } from '../templates/registry'
import { TiltCard } from '../ui/TiltCard'
import { StampCanvas } from './StampCanvas'

export function TemplatePicker() {
  const selectTemplate = useBooth((s) => s.selectTemplate)
  const previews = useMemo(
    () => templates.map((t) => ({ t, photo: placeholderPhoto(t), values: resolveDefaults(t) })),
    [],
  )
  return (
    <section className="screen">
      <h2>Pick a card</h2>
      <div className="picker-grid">
        {previews.map(({ t, photo, values }, i) => (
          <TiltCard key={t.id} delay={i * 0.4}>
            <button className="picker-card" onClick={() => selectTemplate(t.id)}>
              <StampCanvas template={t} photo={photo} values={values} scale={2} label={`${t.name} preview`} />
              <span className="card-label">{t.name}</span>
            </button>
          </TiltCard>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Update `src/App.tsx`** (Booth/Editor placeholders until Tasks 10–11)

```tsx
import { TemplatePicker } from './screens/TemplatePicker'
import { useBooth } from './store/booth'
import { SwirlBackground } from './ui/SwirlBackground'

export default function App() {
  const screen = useBooth((s) => s.screen)
  return (
    <>
      <SwirlBackground />
      <main className="app">
        <h1 className="logo">PIXEL BOOTH</h1>
        {screen === 'picker' && <TemplatePicker />}
        {screen === 'booth' && <p>Booth coming soon</p>}
        {screen === 'editor' && <p>Editor coming soon</p>}
      </main>
    </>
  )
}
```

- [ ] **Step 4: Write `src/index.css`**

```css
:root {
  --ink: #f6ecd6;
  --dark: #1c1e2c;
  --panel: #2b2f45;
  --red: #e5484d;
  --red-dark: #a82c3a;
  --blue: #0091e6;
  --blue-dark: #0062a8;
  --gold: #f5b142;
  --gold-dark: #c47a1e;
  --font: 'Pixelify Sans', ui-monospace, monospace;
  color-scheme: dark;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background: var(--dark);
  color: var(--ink);
  font: 18px/1.4 var(--font);
}

/* Fixed swirl canvas; the gradient is the fallback when WebGL is unavailable. */
.swirl {
  position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1;
  image-rendering: pixelated;
  background:
    radial-gradient(circle at 30% 30%, var(--red) 0, transparent 55%),
    radial-gradient(circle at 70% 70%, var(--blue) 0, transparent 55%),
    var(--dark);
}

.app { max-width: 1000px; margin: 0 auto; padding: 24px 16px 56px; }
.logo {
  font: 700 44px/1 var(--font); text-align: center; margin: 8px 0 28px; letter-spacing: 2px;
  color: var(--ink); text-shadow: 4px 4px 0 var(--dark), -2px -2px 0 var(--red);
}
h2 { font: 700 26px/1.2 var(--font); text-align: center; margin: 0 0 16px; text-shadow: 3px 3px 0 var(--dark); }
.screen { display: flex; flex-direction: column; align-items: center; gap: 18px; }

.stamp-canvas { image-rendering: pixelated; max-width: 100%; height: auto; display: block; }

/* Template cards */
.picker-grid { display: flex; flex-wrap: wrap; gap: 28px; justify-content: center; align-items: center; }
.tilt { perspective: 700px; --rx: 0deg; --ry: 0deg; }
.tilt-inner {
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transition: transform 120ms ease-out;
  animation: bob 3.2s ease-in-out infinite;
}
@keyframes bob { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }
.picker-card {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  background: none; border: 0; padding: 8px; cursor: pointer; color: var(--ink);
  transition: transform 120ms ease-out, filter 120ms ease-out;
}
.picker-card:hover, .picker-card:focus-visible { transform: scale(1.06); filter: drop-shadow(0 10px 0 rgb(0 0 0 / 0.35)); outline: none; }
.picker-card:focus-visible .card-label { outline: 3px solid var(--gold); }
.card-label { font: 700 20px var(--font); text-shadow: 2px 2px 0 var(--dark); padding: 2px 8px; }

/* Chunky buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  font: 700 18px/1 var(--font); padding: 12px 20px; cursor: pointer;
  color: var(--ink); background: var(--panel);
  border: 3px solid var(--dark); border-radius: 8px;
  box-shadow: 0 5px 0 var(--dark); text-shadow: 2px 2px 0 var(--dark);
  transition: transform 80ms, box-shadow 80ms;
}
.btn.red { background: var(--red); box-shadow: 0 5px 0 var(--red-dark), 0 5px 0 3px var(--dark); }
.btn.blue { background: var(--blue); box-shadow: 0 5px 0 var(--blue-dark), 0 5px 0 3px var(--dark); }
.btn.gold { background: var(--gold); color: var(--dark); text-shadow: none; box-shadow: 0 5px 0 var(--gold-dark), 0 5px 0 3px var(--dark); }
.btn:hover:not(:disabled) { transform: translateY(-2px); }
.btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 1px 0 var(--dark); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
.row { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; align-items: center; }

/* Booth */
.preview-wrap { position: relative; }
.preview-wrap canvas { width: min(100%, 520px); }
.countdown {
  position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none;
  font: 700 120px var(--font); color: var(--ink); text-shadow: 6px 6px 0 var(--dark), -3px -3px 0 var(--red);
  animation: count-pop 1s ease-out;
}
@keyframes count-pop { from { transform: scale(1.6); opacity: 0; } 30% { transform: scale(1); opacity: 1; } }
.video-feed { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

.notice {
  background: var(--panel); border: 3px solid var(--dark); border-radius: 8px; box-shadow: 0 5px 0 var(--dark);
  padding: 16px; max-width: 480px; text-align: center;
}
.error { color: #ff9a9a; text-shadow: 1px 1px 0 var(--dark); }

/* Editor */
.pop-in { animation: pop-in 420ms cubic-bezier(.2, 1.6, .4, 1); }
@keyframes pop-in { from { transform: scale(0.6) rotate(-6deg); opacity: 0; } to { transform: none; opacity: 1; } }
.fields {
  display: grid; gap: 12px; width: min(100%, 480px); padding: 16px;
  background: var(--panel); border: 3px solid var(--dark); border-radius: 8px; box-shadow: 0 5px 0 var(--dark);
}
.fields label { display: grid; gap: 4px; font-size: 16px; text-shadow: 2px 2px 0 var(--dark); }
.fields input {
  font: 700 18px var(--font); text-transform: uppercase; padding: 10px;
  background: var(--dark); color: var(--ink); border: 3px solid var(--dark); border-radius: 6px;
}
.fields input:focus { border-color: var(--gold); outline: none; }

.print-only { display: none; }

@media (prefers-reduced-motion: reduce) {
  .tilt-inner, .countdown, .pop-in { animation: none; }
  .tilt-inner { transform: none; }
  .btn, .picker-card { transition: none; }
}

@media print {
  @page { margin: 10mm; }
  body { background: #fff; }
  .swirl, .app > *:not(.print-only) { display: none !important; }
  .print-only { display: block; }
  .print-only img { image-rendering: pixelated; }
}
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open the URL. Expected: animated pixel swirl background; "PIXEL BOOTH" logo; three cards (Stamp, Voucher, Ticket) bobbing out of phase, each showing the smiley placeholder inside its frame with drop shadow; cards tilt toward the pointer; clicking shows "Booth coming soon". With macOS "Reduce motion" on: swirl is a still frame, no bob/tilt. At ~375px width: cards wrap, no horizontal scroll.

Run: `npm test && npm run build && npm run lint` → Expected: all succeed.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/index.css src/screens
git commit -m "feat: add app shell, Balatro-inspired styles, and template picker"
```

---

### Task 10: Booth screen

**Files:**
- Create: `src/screens/Booth.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useCamera`, `useBooth`, `getTemplate`, `placeholderPhoto`, `cropPhoto`, `PhotoSource`, `composeStamp`, `PREVIEW_SCALE`, `EXPORT_SCALE`

- [ ] **Step 1: Create `src/screens/Booth.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useCamera, type CameraStatus } from '../camera/useCamera'
import { cropPhoto, type PhotoSource } from '../photo/crop'
import { composeStamp } from '../render/composeStamp'
import { EXPORT_SCALE, PREVIEW_SCALE } from '../render/export'
import { useBooth } from '../store/booth'
import { placeholderPhoto } from '../templates/placeholder'
import { getTemplate } from '../templates/registry'

const MESSAGES: Partial<Record<CameraStatus, string>> = {
  insecure: 'The camera only works over HTTPS (or on localhost). You can still upload a photo.',
  denied: 'Camera access was blocked. Allow it in your browser’s site settings, then retry — or upload a photo.',
  unavailable: 'No camera was found. Plug one in and retry, or upload a photo.',
}

export function Booth() {
  const templateId = useBooth((s) => s.templateId)
  const values = useBooth((s) => s.values)
  const { setCapture, goToPicker } = useBooth.getState()
  const template = getTemplate(templateId)

  const { videoRef, status, start } = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [count, setCount] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    void start()
  }, [start])

  const liveSource = useCallback((): PhotoSource | null => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) return null
    return { source: v, w: v.videoWidth, h: v.videoHeight, mirror: true }
  }, [videoRef])

  // Idle preview: placeholder until the camera is live.
  useEffect(() => {
    if (status === 'live' || !canvasRef.current) return
    composeStamp(template, placeholderPhoto(template), values, PREVIEW_SCALE, canvasRef.current)
  }, [status, template, values])

  // Live preview loop.
  useEffect(() => {
    if (status !== 'live') return
    let raf = 0
    const tick = () => {
      const photo = liveSource()
      if (photo && canvasRef.current) {
        composeStamp(template, photo, useBooth.getState().values, PREVIEW_SCALE, canvasRef.current)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, template, liveSource])

  const keep = useCallback(
    (photo: PhotoSource) => {
      const r = template.photoRect
      setCapture(cropPhoto(photo, r.w * EXPORT_SCALE, r.h * EXPORT_SCALE))
    },
    [template, setCapture],
  )

  // Countdown 3 → 2 → 1 → capture.
  useEffect(() => {
    if (count === null) return
    if (count === 0) {
      setCount(null)
      const photo = liveSource()
      if (photo) keep(photo)
      return
    }
    const id = setTimeout(() => setCount(count - 1), 1000)
    return () => clearTimeout(id)
  }, [count, liveSource, keep])

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadError(null)
    try {
      const bmp = await createImageBitmap(file)
      keep({ source: bmp, w: bmp.width, h: bmp.height })
      bmp.close()
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
        {count !== null && count > 0 && (
          <div key={count} className="countdown" aria-live="assertive">{count}</div>
        )}
      </div>

      {message && (
        <div className="notice" role="alert">
          <p>{message}</p>
          {status !== 'insecure' && <button className="btn blue" onClick={() => void start()}>Retry camera</button>}
        </div>
      )}
      {status === 'requesting' && <p>Waiting for camera permission…</p>}

      <div className="row">
        <button className="btn" onClick={goToPicker}>Back</button>
        <button className="btn red" disabled={status !== 'live' || count !== null} onClick={() => setCount(3)}>
          Take photo
        </button>
        <label className="btn blue">
          Upload photo
          <input type="file" accept="image/*" hidden onChange={onUpload} />
        </label>
      </div>
      {uploadError && <p className="error" role="alert">{uploadError}</p>}
    </section>
  )
}
```

(`cropPhoto` copies the bitmap into a new canvas, so closing the bitmap afterwards is safe. The `key={count}` on the countdown restarts its pop animation each second.)

- [ ] **Step 2: Wire into `src/App.tsx`** — replace the booth placeholder with `{screen === 'booth' && <Booth />}` and add `import { Booth } from './screens/Booth'`.

- [ ] **Step 3: Verify in the browser** (`npm run dev`, Chrome)

Expected:
1. Pick Stamp → permission prompt → live mirrored camera inside the frame; photo is smooth, frame pixels crisp.
2. Take photo → 3, 2, 1 pop → screen switches to "Editor coming soon".
3. Back → camera indicator light turns off.
4. Block camera in site settings → reload → pick a template → "blocked" notice with Retry. Upload a JPG → editor placeholder. Upload a renamed `.txt` → inline error, stays on Booth.

Run: `npm test && npm run build && npm run lint` → Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Booth.tsx src/App.tsx
git commit -m "feat: add booth screen with live preview, countdown, and upload"
```

---

### Task 11: Editor screen

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

  const renderFull = () => composeStamp(template, capture, values, EXPORT_SCALE)

  function download() {
    renderFull().toBlob((blob) => {
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
    setPrint((p) => ({ url: renderFull().toDataURL('image/png'), n: (p?.n ?? 0) + 1 }))
  }

  const printRoot = document.querySelector('.app')

  return (
    <section className="screen">
      <h2>{template.name}</h2>
      <div className="preview-wrap">
        <StampCanvas
          className="pop-in"
          template={template}
          photo={capture}
          values={values}
          scale={PREVIEW_SCALE}
          label={`Your ${template.name.toLowerCase()}`}
        />
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
        <button className="btn gold" onClick={download}>Download PNG</button>
        <button className="btn blue" onClick={startPrint}>Print</button>
      </div>
      <div className="row">
        <button className="btn red" onClick={retake}>Retake</button>
        <button className="btn" onClick={goToPicker}>Change card</button>
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

Note on print: `.print-only img { image-rendering: pixelated }` keeps the frame crisp; at 8× export resolution the photo is already detailed enough that nearest-neighbor resampling in print is not visible.

- [ ] **Step 2: Wire into `src/App.tsx`** — replace the editor placeholder with `{screen === 'editor' && <Editor />}` and add `import { Editor } from './screens/Editor'`.

- [ ] **Step 3: Verify in the browser** (Chrome, then Safari if available)

Expected:
1. Capture with each template → editor pops in with the captured photo in the frame, mirrored the same as the live preview.
2. Typing updates the preview live; lowercase renders uppercase; pasting 100 characters is clamped; emoji renders as `?` without errors.
3. Download PNG → `pixel-booth-<id>-<timestamp>.png`, dimensions = size × 8 (stamp 792×984, voucher 1528×760, ticket 1528×632). Zoom in: frame pixels are crisp blocks; the photo is smooth and detailed.
4. Print → dialog shows only the card at physical size (stamp 50×62mm); no swirl background; pressing Print again without edits reopens the dialog.
5. Ticket: Retake → new capture → serial changes, typed event name stays.
6. Change card → pick the same template → edits still there.
7. Upload a portrait photo on the Ticket → cropped, not stretched.

Run: `npm test && npm run build && npm run lint` → Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Editor.tsx src/App.tsx
git commit -m "feat: add editor with live fields, PNG download, and print"
```

---

### Task 12: README and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md`**

````markdown
# Pixel Booth

A browser photobooth that puts your photo inside a pixel-art **stamp**, **voucher**, or **ticket** — download it as a PNG or print it. The photo stays exactly as taken; the frames are pixel art.

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

1. Create `src/templates/<name>.ts` exporting a `Template` (see `src/templates/types.ts`). Draw the frame and text at art-pixel scale with `draw.ts`, `colors.ts`, and `pixelFont.ts`. Leave the photo to the composer — just set `photoRect`.
2. Add it to the list in `src/templates/registry.ts`.
3. `npm test` — the contract test in `templates.test.ts` checks it automatically.

## Credits

UI font: Pixelify Sans (SIL Open Font License 1.1). Visual style inspired by pixel-art card games; all art is original.
````

- [ ] **Step 2: Full verification**

Run: `npm test && npm run build && npm run lint && git status`
Expected: all tests pass, build succeeds, lint clean, only `README.md` modified.

Run: `npm run preview`, open the URL, repeat Task 11 Step 3 items 1, 3, 4 against the production build.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with run, deploy, and template guide"
```
