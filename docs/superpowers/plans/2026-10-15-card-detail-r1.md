# Card Detail Pass Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5×7 heading font and shared pixel-detail helpers, then redraw Stamp, Ticket (with a new Seat field) and Voucher at the camera's level of detail.

**Architecture:** `src/templates/pixelFontLarge.ts` (big glyphs, `drawBig`, `drawTitle` fallback chain) and `src/templates/detail.ts` (bevel, dither, hatch, ornaments, guilloche, rings/postmark, vertical text) are pure canvas helpers on the art-pixel grid. The three template modules are rewritten on top of them; sizes, photo rules and print sizes stay as they are (stamp's photo window grows).

**Tech Stack:** Vite 8, React 19.2, TypeScript ~6.0, Vitest 4.1 (jsdom, vitest-canvas-mock).

**Spec:** `docs/superpowers/specs/2026-10-15-card-detail-r1-design.md`

## Global Constraints

- Art sizes unchanged: stamp 96×120, ticket 188×76, voucher 188×92 (+3 shadow). Print sizes unchanged: stamp 50×62.1, voucher 120×59.7, ticket 144×59.6 mm.
- `render()` never draws the photo; photo stays smooth; frame details are drawn with `fill`/`fillRect` only (editions treat them as frame pixels).
- Big font: 5×7 glyphs, advance 6. `drawTitle` line height 14 px.
- No real brand names or copied art.
- Conventional Commits; no AI attribution. Before each commit: `npx tsc -b && npm run lint && npx vitest run`.

## Review Focus

1. Long user text in every redrawn slot (14-char titles of wide letters like `WWWWWWWWWWWWWW`, emoji, `ß`) must never draw outside its slot. Tests in Tasks 1, 3–5.
2. Detail helpers must never paint inside the photo window (postmark especially). Tests in Tasks 2–3.
3. Remembered ticket values from before the Seat field still render and gain the default. Test in Task 4.
4. Editions still only touch frame pixels and the photo is drawn last (existing composeStamp tests must stay green; no change there).
5. The edition badge positions stay clear of the photo (existing template test).

---

### Task 1: Big font and `drawTitle`

**Files:**
- Modify: `src/templates/pixelFont.ts` (export the per-character uppercaser)
- Create: `src/templates/pixelFontLarge.ts`
- Test: `src/templates/pixelFontLarge.test.ts`

**Interfaces:**
- Produces: `upperChar(ch: string): string` (exported from `pixelFont.ts`, existing `upper`); `BIG_GLYPHS`; `BIG_ADVANCE = 6`; `bigGlyphFor(ch)`; `measureBig(text, scale = 1)`; `drawBig(ctx, text, x, y, color, scale = 1, shadow?)`; `drawBigCentered(ctx, text, cx, y, color, scale = 1, shadow?)`; `TITLE_LINE = 14`; `drawTitle(ctx, text, cx, y, maxWidth, color, shadow?, maxScale = 2): { font: 'big' | 'small'; scale: number; width: number }`.

- [ ] **Step 1: Failing tests** — `src/templates/pixelFontLarge.test.ts`

```ts
import { expect, test, vi } from 'vitest'
import { measureText } from './pixelFont'
import { BIG_GLYPHS, bigGlyphFor, drawTitle, measureBig } from './pixelFontLarge'

const ctx = () => document.createElement('canvas').getContext('2d')!

test('every big glyph is 7 rows of 5 binary columns', () => {
  for (const [ch, rows] of Object.entries(BIG_GLYPHS)) {
    expect(rows, ch).toHaveLength(7)
    for (const r of rows) expect(r, ch).toMatch(/^[01]{5}$/)
  }
})

test('covers A–Z, 0–9 and the listed punctuation', () => {
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-!?'&/:#¢★♥№ ") expect(BIG_GLYPHS[ch], ch).toBeDefined()
})

test('lowercase, ß and unknown characters', () => {
  expect(bigGlyphFor('a')).toBe(BIG_GLYPHS.A)
  expect(bigGlyphFor('ß')).toBe(BIG_GLYPHS.S)
  expect(bigGlyphFor('😀')).toBe(BIG_GLYPHS['?'])
})

test('width is (n × 6 − 1) × scale, counting code points', () => {
  expect(measureBig('AB')).toBe(11)
  expect(measureBig('AB', 2)).toBe(22)
  expect(measureBig('😀x')).toBe(11)
  expect(measureBig('')).toBe(0)
})

test('drawTitle steps down big 2 → big 1 → small 2 → small 1, then truncates', () => {
  expect(drawTitle(ctx(), 'HI', 50, 0, 100, [0, 0, 0])).toEqual({ font: 'big', scale: 2, width: measureBig('HI', 2) })
  expect(drawTitle(ctx(), 'HELLO', 50, 0, 40, [0, 0, 0])).toEqual({ font: 'big', scale: 1, width: measureBig('HELLO') })
  const s = drawTitle(ctx(), 'HELLO THERE', 50, 0, 50, [0, 0, 0])
  expect(s).toEqual({ font: 'small', scale: 1, width: measureText('HELLO THERE') })
  const t = drawTitle(ctx(), 'W'.repeat(40), 50, 0, 30, [0, 0, 0])
  expect(t.font).toBe('small')
  expect(t.width).toBeLessThanOrEqual(30)
})

test('drawTitle never paints outside its slot', () => {
  for (const text of ['WWWWWWWWWWWWWW', 'ß😀ß😀ß😀ß😀', 'PIXEL PARTY', '']) {
    const c = ctx()
    const fr = vi.spyOn(c, 'fillRect')
    drawTitle(c, text, 50, 10, 40, [0, 0, 0], [9, 9, 9])
    for (const [x, y, w, h] of fr.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(30 - 2)
      expect(x + w).toBeLessThanOrEqual(70 + 2)
      expect(y).toBeGreaterThanOrEqual(10)
      expect(y + h).toBeLessThanOrEqual(10 + 14 + 2)
    }
  }
})
```

(The `+ 2` allows the 1–2 px drop shadow.)

- [ ] **Step 2: Run** `npx vitest run src/templates/pixelFontLarge.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

In `src/templates/pixelFont.ts` rename `const upper` to `export const upperChar` and update its two uses.

`src/templates/pixelFontLarge.ts`:

```ts
import { drawBitmap, type Color } from './draw'
import { drawTextCentered, measureText, upperChar } from './pixelFont'

/** 5×7 heading font; the 3×5 font stays for small print. */
export const BIG_ADVANCE = 6
export const TITLE_LINE = 14

export const BIG_GLYPHS: Record<string, readonly string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '¢': ['00100', '01110', '10101', '10100', '10101', '01110', '00100'],
  '★': ['00100', '00100', '11111', '01110', '01110', '11011', '10001'],
  '♥': ['00000', '01010', '11111', '11111', '01110', '00100', '00000'],
  '№': ['10011', '11011', '10111', '10100', '10111', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

const chars = (text: string) => Array.from(text, upperChar)

export const bigGlyphFor = (ch: string): readonly string[] => BIG_GLYPHS[upperChar(ch)] ?? BIG_GLYPHS['?']

export function measureBig(text: string, scale = 1): number {
  const n = chars(text).length
  return n === 0 ? 0 : (n * BIG_ADVANCE - 1) * scale
}

export function drawBig(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: Color, scale = 1, shadow?: Color) {
  const glyphs = chars(text).map(bigGlyphFor)
  if (shadow) glyphs.forEach((g, i) => drawBitmap(ctx, g, x + i * BIG_ADVANCE * scale + scale, y + scale, shadow, scale))
  glyphs.forEach((g, i) => drawBitmap(ctx, g, x + i * BIG_ADVANCE * scale, y, color, scale))
}

export function drawBigCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: Color, scale = 1, shadow?: Color) {
  drawBig(ctx, text, Math.round(cx - measureBig(text, scale) / 2), y, color, scale, shadow)
}

/**
 * Title on a 14 px line starting at `y`, centred on `cx`: the big font at maxScale…1, then the small font at 2…1,
 * whichever first fits maxWidth; if nothing fits, the small font truncated to fit. Returns what it drew.
 */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  color: Color,
  shadow?: Color,
  maxScale = 2,
): { font: 'big' | 'small'; scale: number; width: number } {
  for (let s = maxScale; s >= 1; s--) {
    const w = measureBig(text, s)
    if (w <= maxWidth && 7 * s <= TITLE_LINE) {
      drawBigCentered(ctx, text, cx, y + Math.floor((TITLE_LINE - 7 * s) / 2), color, s, shadow)
      return { font: 'big', scale: s, width: w }
    }
  }
  for (const s of [2, 1]) {
    const w = measureText(text, s)
    if (w <= maxWidth) {
      drawTextCentered(ctx, text, cx, y + Math.floor((TITLE_LINE - 5 * s) / 2), color, s, shadow)
      return { font: 'small', scale: s, width: w }
    }
  }
  let cut = Array.from(text)
  while (cut.length && measureText(cut.join('')) > maxWidth) cut = cut.slice(0, -1)
  const fitted = cut.join('')
  drawTextCentered(ctx, fitted, cx, y + Math.floor((TITLE_LINE - 5) / 2), color, 1, shadow)
  return { font: 'small', scale: 1, width: measureText(fitted) }
}
```

- [ ] **Step 4: Run** — Expected: PASS (6 tests); full suite green (rename of `upper`).
- [ ] **Step 5: Commit** `feat: add a 5x7 heading font with a title fallback chain`

---

### Task 2: Detail helpers

**Files:**
- Create: `src/templates/detail.ts`
- Test: `src/templates/detail.test.ts`

**Interfaces:**
- Consumes: `fill`, `drawBitmap`, `Color`, `Rect` (`draw.ts`); `drawText`, `measureText` (`pixelFont.ts`); `drawBig`, `measureBig` (Task 1).
- Produces: `bevel(ctx, r, light, dark)`, `dither(ctx, r, color, density, seed = 0)`, `hatch(ctx, r, color, step)`, `cornerOrnaments(ctx, r, color)`, `guilloche(ctx, r, color, period, amplitude)`, `ring(ctx, cx, cy, r, color, avoid?: Rect)`, `postmark(ctx, cx, cy, r, color, avoid?: Rect)`, `drawTextVertical(ctx, text, x, y, color, font: 'big' | 'small', shadow?)` (x = left of the rotated text column, y = bottom where the text starts), `verticalLength(text, font)`.

- [ ] **Step 1: Failing tests** — `src/templates/detail.test.ts`

```ts
import { expect, test, vi } from 'vitest'
import { bevel, cornerOrnaments, dither, drawTextVertical, guilloche, hatch, postmark, ring } from './detail'
import { drawText } from './pixelFont'

const R = { x: 10, y: 20, w: 40, h: 30 }
const C: [number, number, number] = [1, 2, 3]
function rects(draw: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas').getContext('2d')!
  const fr = vi.spyOn(c, 'fillRect')
  draw(c)
  return fr.mock.calls.map(([x, y, w, h]) => ({ x, y, w, h }))
}
const insideR = (p: { x: number; y: number; w: number; h: number }) =>
  p.x >= R.x && p.y >= R.y && p.x + p.w <= R.x + R.w && p.y + p.h <= R.y + R.h

test.each([
  ['bevel', (c: CanvasRenderingContext2D) => bevel(c, R, C, C)],
  ['dither', (c: CanvasRenderingContext2D) => dither(c, R, C, 0.3, 1)],
  ['hatch', (c: CanvasRenderingContext2D) => hatch(c, R, C, 2)],
  ['cornerOrnaments', (c: CanvasRenderingContext2D) => cornerOrnaments(c, R, C)],
  ['guilloche', (c: CanvasRenderingContext2D) => guilloche(c, R, C, 16, 2)],
])('%s paints only inside its rect', (_n, draw) => {
  const out = rects(draw)
  expect(out.length).toBeGreaterThan(0)
  expect(out.every(insideR)).toBe(true)
})

test('dither is deterministic per seed', () => {
  const a = rects((c) => dither(c, R, C, 0.3, 1))
  expect(rects((c) => dither(c, R, C, 0.3, 1))).toEqual(a)
  expect(rects((c) => dither(c, R, C, 0.3, 2))).not.toEqual(a)
})

test('ring pixels lie on the circle', () => {
  for (const p of rects((c) => ring(c, 50, 50, 10, C))) {
    const d = Math.hypot(p.x - 50, p.y - 50)
    expect(Math.abs(d - 10)).toBeLessThanOrEqual(1)
  }
})

test('ring and postmark skip the avoid rect (the photo window)', () => {
  const avoid = { x: 40, y: 40, w: 30, h: 30 }
  for (const draw of [(c: CanvasRenderingContext2D) => ring(c, 50, 50, 12, C, avoid), (c: CanvasRenderingContext2D) => postmark(c, 50, 50, 12, C, avoid)])
    for (const p of rects(draw)) {
      const hit = p.x < avoid.x + avoid.w && p.x + p.w > avoid.x && p.y < avoid.y + avoid.h && p.y + p.h > avoid.y
      expect(hit).toBe(false)
    }
})

test('vertical text draws the same pixels as horizontal text, rotated a quarter turn', () => {
  const c = document.createElement('canvas').getContext('2d')!
  const rot = vi.spyOn(c, 'rotate')
  const vertical = rects((cc) => drawTextVertical(cc, 'NO. 123', 5, 60, C, 'small')).length
  const horizontal = rects((cc) => drawText(cc, 'NO. 123', 0, 0, C)).length
  expect(vertical).toBe(horizontal)
  drawTextVertical(c, 'A', 0, 10, C, 'big')
  expect(rot).toHaveBeenCalledWith(-Math.PI / 2)
})
```

- [ ] **Step 2: Run** — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** — `src/templates/detail.ts`

```ts
import { drawBitmap, fill, type Color, type Rect } from './draw'
import { drawText, measureText } from './pixelFont'
import { drawBig, measureBig } from './pixelFontLarge'

// Pixel-detail helpers on the art grid. Everything is drawn with fill/fillRect so editions treat it as frame.

const hash = (x: number, y: number, seed: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
  return n - Math.floor(n)
}

const hits = (x: number, y: number, r?: Rect) => !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

/** Light edge top/left, dark edge bottom/right, 1 px inside `r`. */
export function bevel(ctx: CanvasRenderingContext2D, r: Rect, light: Color, dark: Color) {
  fill(ctx, light, r.x, r.y, r.w, 1)
  fill(ctx, light, r.x, r.y, 1, r.h)
  fill(ctx, dark, r.x, r.y + r.h - 1, r.w, 1)
  fill(ctx, dark, r.x + r.w - 1, r.y, 1, r.h)
}

/** Deterministic speckle texture (paper grain, linen). */
export function dither(ctx: CanvasRenderingContext2D, r: Rect, color: Color, density: number, seed = 0) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) if (hash(x, y, seed) < density) fill(ctx, color, x, y, 1, 1)
}

/** Engraved horizontal line pattern. */
export function hatch(ctx: CanvasRenderingContext2D, r: Rect, color: Color, step: number) {
  for (let y = r.y; y < r.y + r.h; y += step) fill(ctx, color, r.x, y, r.w, 1)
}

const FLOURISH = ['11110', '10000', '10110', '10010', '00000']
const flipH = (rows: readonly string[]) => rows.map((row) => [...row].reverse().join(''))
const flipV = (rows: readonly string[]) => [...rows].reverse()

/** A small flourish in each inner corner of `r`. */
export function cornerOrnaments(ctx: CanvasRenderingContext2D, r: Rect, color: Color) {
  const right = r.x + r.w - 5
  const bottom = r.y + r.h - 5
  drawBitmap(ctx, FLOURISH, r.x, r.y, color)
  drawBitmap(ctx, flipH(FLOURISH), right, r.y, color)
  drawBitmap(ctx, flipV(FLOURISH), r.x, bottom, color)
  drawBitmap(ctx, flipV(flipH(FLOURISH)), right, bottom, color)
}

/** Banknote-style pattern: two interleaved sine lines, repeated every 4 px down `r`. */
export function guilloche(ctx: CanvasRenderingContext2D, r: Rect, color: Color, period: number, amplitude: number) {
  for (let base = r.y + amplitude; base < r.y + r.h - amplitude; base += 4)
    for (let x = r.x; x < r.x + r.w; x++) {
      const t = (2 * Math.PI * (x - r.x)) / period
      for (const phase of [0, Math.PI]) {
        const y = Math.round(base + amplitude * Math.sin(t + phase))
        if (y >= r.y && y < r.y + r.h) fill(ctx, color, x, y, 1, 1)
      }
    }
}

/** 1 px pixel circle (midpoint algorithm); skips pixels inside `avoid`. */
export function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: Color, avoid?: Rect) {
  let x = r
  let y = 0
  let err = 1 - r
  const plot = (px: number, py: number) => {
    if (!hits(px, py, avoid)) fill(ctx, color, px, py, 1, 1)
  }
  while (x >= y) {
    for (const [dx, dy] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) plot(cx + dx, cy + dy)
    y++
    if (err < 0) err += 2 * y + 1
    else {
      x--
      err += 2 * (y - x) + 1
    }
  }
}

/** Postal cancellation: two rings and three wavy lines to the left. */
export function postmark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: Color, avoid?: Rect) {
  ring(ctx, cx, cy, r, color, avoid)
  ring(ctx, cx, cy, r - 2, color, avoid)
  for (let i = -1; i <= 1; i++)
    for (let x = cx - r - 18; x < cx - r - 1; x++) {
      const y = cy + i * 3 + Math.round(Math.sin(x / 2))
      if (!hits(x, y, avoid)) fill(ctx, color, x, y, 1, 1)
    }
}

/** Length along the column of rotated text. */
export const verticalLength = (text: string, font: 'big' | 'small') => (font === 'big' ? measureBig(text) : measureText(text))

/** Text turned a quarter left (reads bottom to top), starting at the bottom-left (x, y). */
export function drawTextVertical(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: Color, font: 'big' | 'small', shadow?: Color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-Math.PI / 2)
  if (font === 'big') drawBig(ctx, text, 0, 0, color, 1, shadow)
  else drawText(ctx, text, 0, 0, color, 1, shadow)
  ctx.restore()
}
```

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: add pixel detail helpers (bevel, dither, hatch, ornaments, guilloche, postmark, vertical text)`

---

### Task 3: Stamp redraw

**Files:**
- Modify: `src/templates/colors.ts`, `src/templates/stamp.ts`
- Test: `src/templates/stamp.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: colours `RED_MID, RED_LIGHT, CREAM_DARK, GOLD_LIGHT, GOLD_MID, BLUE_MID`; stamp `photoRect = { x: 10, y: 10, w: 76, h: 82 }`.

- [ ] **Step 1: Failing tests** — `src/templates/stamp.test.ts`

```ts
import { expect, test, vi } from 'vitest'
import { stamp } from './stamp'

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

test('bigger photo window, same print size', () => {
  expect(stamp.photoRect).toEqual({ x: 10, y: 10, w: 76, h: 82 })
  expect(stamp.size).toEqual({ w: 99, h: 123 })
  expect(stamp.printSizeMm).toEqual({ w: 50, h: 62.1 })
})

test('nothing but the mat keyline is drawn inside the photo window', () => {
  const c = document.createElement('canvas')
  c.width = stamp.size.w
  c.height = stamp.size.h
  const ctx = c.getContext('2d')!
  const fr = vi.spyOn(ctx, 'fillRect')
  stamp.render(ctx, { title: 'WWWWWWWWWWWWWW', value: '99¢' })
  const inner = { ...stamp.photoRect }
  const bad = fr.mock.calls
    .map(([x, y, w, h]) => ({ x, y, w, h }))
    // body-sized fills (the background) are fine; detail must stay off the photo
    .filter((r) => r.w * r.h < 400 && overlaps(r, inner))
  expect(bad).toEqual([])
})

test('long titles and values stay inside the card', () => {
  const c = document.createElement('canvas').getContext('2d')!
  const fr = vi.spyOn(c, 'fillRect')
  stamp.render(c, { title: 'WWWWWWWWWWWWWW', value: 'WWWWW' })
  for (const [x, y, w, h] of fr.mock.calls) {
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x + w).toBeLessThanOrEqual(96)
    expect(y + h).toBeLessThanOrEqual(120)
  }
})
```

Note: `stamp.render` draws via `withDropShadow`, which paints into an offscreen canvas — spy on `CanvasRenderingContext2D.prototype.fillRect` instead of the instance if the instance spy records nothing; filter calls to the body canvas size (96×120 coordinates).

- [ ] **Step 2: Run** — Expected: FAIL (old photo rect).

- [ ] **Step 3: Implement**

Append to `src/templates/colors.ts`:

```ts
export const RED_MID: Color = [212, 62, 68]
export const RED_LIGHT: Color = [246, 120, 116]
export const CREAM_DARK: Color = [224, 208, 178]
export const GOLD_LIGHT: Color = [255, 214, 120]
export const GOLD_MID: Color = [232, 160, 52]
export const BLUE_MID: Color = [0, 128, 206]
```

`src/templates/stamp.ts` — replace `PHOTO` and `body`:

```ts
const PHOTO = { x: 10, y: 10, w: 76, h: 82 }

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  fill(ctx, OUTLINE, 0, 0, BW, BH)
  fill(ctx, RED, 1, 1, BW - 2, BH - 2)
  hatch(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, RED_MID, 2)
  bevel(ctx, { x: 1, y: 1, w: BW - 2, h: BH - 2 }, RED_LIGHT, RED_DARK)

  // Perforated edge with a shadow inside each notch.
  for (let x = 1; x + 4 <= BW; x += 6) {
    ctx.clearRect(x, 0, 4, 2)
    ctx.clearRect(x + 1, 2, 2, 1)
    fill(ctx, RED_DARK, x + 1, 3, 2, 1)
    ctx.clearRect(x, BH - 2, 4, 2)
    ctx.clearRect(x + 1, BH - 3, 2, 1)
    fill(ctx, RED_DARK, x + 1, BH - 4, 2, 1)
  }
  for (let y = 1; y + 4 <= BH; y += 6) {
    ctx.clearRect(0, y, 2, 4)
    ctx.clearRect(2, y + 1, 1, 2)
    fill(ctx, RED_DARK, 3, y + 1, 1, 2)
    ctx.clearRect(BW - 2, y, 2, 4)
    ctx.clearRect(BW - 3, y + 1, 1, 2)
    fill(ctx, RED_DARK, BW - 4, y + 1, 1, 2)
  }

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  bevel(ctx, { x: PHOTO.x - 3, y: PHOTO.y - 3, w: PHOTO.w + 6, h: PHOTO.h + 6 }, CREAM, CREAM_DARK)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  postmark(ctx, 84, 8, 9, RED_DARK, PHOTO)

  drawTitle(ctx, values.title ?? '', BW / 2, 94, 76, CREAM, RED_DARK, 1)
  drawText(ctx, 'PIXEL POST', 8, 109, GOLD, 1, RED_DARK)

  // Value in the big font on a gold plate, bottom right.
  panel(ctx, OUTLINE, 60, 105, 30, 12, 2)
  panel(ctx, GOLD, 61, 106, 28, 10, 1)
  bevel(ctx, { x: 62, y: 106, w: 26, h: 10 }, GOLD_LIGHT, GOLD_DARK)
  drawTitle(ctx, values.value ?? '', 75, 104, 24, OUTLINE, undefined, 1)
}
```

Update imports: `CREAM_DARK, GOLD_DARK, GOLD_LIGHT, RED_LIGHT, RED_MID` from `./colors`; `bevel, hatch, postmark` from `./detail`; `drawTitle` from `./pixelFontLarge`; drop `drawTextCentered` if unused.

- [ ] **Step 4: Run** `npx vitest run src/templates` — Expected: PASS (new + existing template tests).
- [ ] **Step 5: Commit** `feat: redraw the stamp with engraving, postmark and a big-font value`

---

### Task 4: Ticket redraw and Seat field

**Files:**
- Modify: `src/templates/ticket.ts`, `src/store/booth.ts`, `src/packs/deal.ts`
- Test: `src/templates/ticket.test.ts`, `src/store/booth.test.ts`, `src/packs/deal.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (colours).
- Produces: ticket field `seat`; `selectTemplate` and `dealPack` merge `{ ...resolveDefaults(t), ...saved[id] }`.

- [ ] **Step 1: Failing tests**

`src/templates/ticket.test.ts` (append):

```ts
test('the ticket has a Seat field after Date', () => {
  const keys = getTemplate('ticket').fields.map((f) => f.key)
  expect(keys).toEqual(['event', 'date', 'seat', 'serial'])
  expect(resolveDefaults(getTemplate('ticket')).seat).toBe('ROW A SEAT 07')
})

test('the serial runs down the stub, clear of the edition badge', async () => {
  const detail = await import('./detail')
  const spy = vi.spyOn(detail, 'drawTextVertical')
  const t = getTemplate('ticket')
  const c = document.createElement('canvas').getContext('2d')!
  t.render(c, { ...resolveDefaults(t), serial: 'NO. 123456' })
  expect(spy).toHaveBeenCalled()
  const [, text, , y] = spy.mock.calls[0]
  expect(text).toBe('NO. 123456')
  expect(y).toBeLessThanOrEqual(76 - 9) // badge sits in the bottom 9 px of the stub
})
```

(Add `vi` to the vitest import. If ESM spying on `drawTextVertical` does not intercept the template's call, assert instead via `vi.spyOn(CanvasRenderingContext2D.prototype, 'rotate')` being called with `-Math.PI / 2`, and ledger the change.)

`src/store/booth.test.ts` (inside the describe):

```ts
  test('remembered values from before a new field get its default', () => {
    useBooth.setState({ saved: { ticket: { event: 'OLD', date: '2026-01-01', serial: 'NO. 000001' } } })
    s().selectTemplate('ticket')
    expect(s().values.event).toBe('OLD')
    expect(s().values.seat).toBe('ROW A SEAT 07')
  })
```

`src/packs/deal.test.ts` (append):

```ts
test('dealt cards fill fields missing from remembered values', () => {
  const pack = { ...getPack('classic'), templates: ['ticket', 'ticket', 'ticket'] as const }
  const cards = dealPack(pack as never, { weights: { common: 1, foil: 0, holo: 0, poly: 0 }, forced: 'random' }, { ticket: { event: 'OLD' } }, () => 0.5)
  expect(cards[0].values.seat).toBe('ROW A SEAT 07')
  expect(cards[0].values.event).toBe('OLD')
})
```

(Adapt the pack shape to `PackDef` as defined in `src/packs/catalog.ts` — e.g. use `getPack('classic')` and pass `saved` with only a `ticket` entry if the classic pack can deal a ticket with a fixed `rand`; ledger the adaptation.)

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/store/booth.ts` `selectTemplate`: `values: refreshPerCapture(getTemplate(id), { ...resolveDefaults(getTemplate(id)), ...get().saved[id] })`.
`src/packs/deal.ts`: `const base = { ...resolveDefaults(t), ...saved[t.id] }`.

`src/templates/ticket.ts` — fields:

```ts
    { key: 'event', label: 'Event', default: 'PIXEL PARTY', maxLength: 14 },
    { key: 'date', label: 'Date', default: () => todayIso(), maxLength: 10 },
    { key: 'seat', label: 'Seat', default: 'ROW A SEAT 07', maxLength: 14 },
    { key: 'serial', label: 'Serial', default: () => randomSerial(), maxLength: 10, perCapture: true },
```

Replace `body` (keep `serialLines` exported for its existing test, now unused by the render — or keep it in use for the small-font fallback):

```ts
const SERIAL_TOP = 22
const SERIAL_BOTTOM = BH - 11 // clear of the edition badge in the stub's bottom 9 px

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, GOLD, 1, 1, BW - 2, BH - 2, 2)
  guilloche(ctx, { x: 72, y: 3, w: STUB - 74, h: BH - 6 }, GOLD_MID, 24, 2)
  bevel(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, GOLD_LIGHT, GOLD_DARK)

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

  // ADMIT ONE ribbon with notched ends.
  fill(ctx, OUTLINE, 74, 3, 70, 13)
  fill(ctx, RED, 75, 4, 68, 11)
  ctx.clearRect(74, 8, 2, 3)
  ctx.clearRect(142, 8, 2, 3)
  drawBigCentered(ctx, 'ADMIT ONE', TEXT_CX, 6, CREAM, 1, RED_DARK)

  panel(ctx, OUTLINE, 74, 20, 70, 20, 2)
  panel(ctx, RED, 75, 21, 68, 18, 1)
  drawTitle(ctx, values.event ?? '', TEXT_CX, 23, 66, CREAM, RED_DARK, 1)

  drawTextCentered(ctx, values.date ?? '', TEXT_CX, 44, OUTLINE)
  drawTextCentered(ctx, values.seat ?? '', TEXT_CX, 52, RED_DARK)
  drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 63, RED_DARK)

  drawTextCentered(ctx, 'ADMIT', STUB_CX, 6, OUTLINE)
  drawTextCentered(ctx, 'ONE', STUB_CX, 13, OUTLINE)
  // Serial runs bottom-to-top down the stub, in the big font when it fits.
  const serial = values.serial ?? ''
  const room = SERIAL_BOTTOM - SERIAL_TOP
  const font = verticalLength(serial, 'big') <= room ? 'big' : 'small'
  let text = serial
  while (text && verticalLength(text, 'small') > room) text = Array.from(text).slice(0, -1).join('')
  const len = verticalLength(text, font)
  const thick = font === 'big' ? 7 : 5
  drawTextVertical(ctx, text, STUB_CX - Math.floor(thick / 2), SERIAL_BOTTOM - Math.floor((room - len) / 2), OUTLINE, font)
}
```

Imports: `GOLD_LIGHT, GOLD_MID` from `./colors`; `bevel, drawTextVertical, guilloche, verticalLength` from `./detail`; `drawBigCentered, drawTitle` from `./pixelFontLarge`; drop `fitScale` if unused. Keep `serialLines` exported (its test still runs).

- [ ] **Step 4: Run** `npx vitest run src/templates src/store src/packs` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: redraw the ticket with a guilloche, ribbon and vertical serial; add a Seat field`

---

### Task 5: Voucher redraw

**Files:**
- Modify: `src/templates/voucher.ts`
- Test: `src/templates/voucher.test.ts` (create)

**Interfaces:** Consumes Tasks 1–3. Expires default becomes `TODAY` (label stays "Expires"; the card prints `VALID UNTIL` above it).

- [ ] **Step 1: Failing tests** — `src/templates/voucher.test.ts`

```ts
import { expect, test, vi } from 'vitest'
import { resolveDefaults } from './fields'
import { voucher } from './voucher'

test('expiry reads VALID UNTIL / TODAY by default', () => {
  expect(resolveDefaults(voucher).expires).toBe('TODAY')
})

test('the stub carries a round seal instead of KEEP THIS', async () => {
  const font = await import('./pixelFont')
  const texts: string[] = []
  const spy = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const draw = vi.spyOn(font, 'drawTextCentered').mockImplementation((_c, t) => void texts.push(t))
  voucher.render(document.createElement('canvas').getContext('2d')!, resolveDefaults(voucher))
  expect(texts).not.toContain('KEEP')
  expect(texts).toEqual(expect.arrayContaining(['VALID UNTIL', 'PIXEL', 'BOOTH']))
  draw.mockRestore()
  spy.mockRestore()
})

test('long text stays inside the card', () => {
  const spy = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  voucher.render(document.createElement('canvas').getContext('2d')!, { title: 'W'.repeat(14), amount: 'W'.repeat(12), expires: 'W'.repeat(14) })
  for (const [x, y, w, h] of spy.mock.calls) {
    expect(x + w).toBeLessThanOrEqual(191)
    expect(y + h).toBeLessThanOrEqual(95)
  }
  spy.mockRestore()
})
```

(If ESM spying on `drawTextCentered` does not intercept, assert the seal through `ring` calls on a spied `detail` module or via pixel counts in the stub; ledger the adaptation.)

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** — `src/templates/voucher.ts` `body`:

```ts
function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, BLUE, 1, 1, BW - 2, BH - 2, 2)
  dither(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, BLUE_MID, 0.14, 7)
  // Double border with corner flourishes.
  outline(ctx, CREAM, 3, 3, BW - 6, BH - 6)
  outline(ctx, GOLD, 5, 5, BW - 10, BH - 10)
  cornerOrnaments(ctx, { x: 7, y: 7, w: BW - 14, h: BH - 14 }, GOLD)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  // Dashed cut line with notches top and bottom.
  for (let y = 6; y < BH - 6; y += 5) fill(ctx, CREAM, CUT, y, 1, 3)
  ctx.clearRect(CUT - 2, 0, 5, 2)
  ctx.clearRect(CUT - 1, 2, 3, 1)
  ctx.clearRect(CUT - 2, BH - 2, 5, 2)
  ctx.clearRect(CUT - 1, BH - 3, 3, 1)

  drawTitle(ctx, values.title ?? '', TEXT_CX, 7, 56, CREAM, BLUE_DARK, 2)

  // Value plate.
  panel(ctx, OUTLINE, 84, 24, 58, 26, 2)
  panel(ctx, GOLD, 85, 25, 56, 24, 1)
  bevel(ctx, { x: 86, y: 25, w: 54, h: 24 }, GOLD_LIGHT, GOLD_DARK)
  drawTitle(ctx, values.amount ?? '', TEXT_CX, 30, 52, OUTLINE, undefined, 2)

  drawTextCentered(ctx, 'VALID UNTIL', TEXT_CX, 55, GOLD, 1, BLUE_DARK)
  drawTitle(ctx, values.expires ?? '', TEXT_CX, 60, 56, CREAM, BLUE_DARK, 1)
  drawTextCentered(ctx, 'PIXEL BOOTH', TEXT_CX, 80, GOLD, 1, BLUE_DARK)

  // Round seal on the stub.
  ring(ctx, STUB_CX, 48, 15, CREAM)
  ring(ctx, STUB_CX, 48, 13, GOLD)
  drawBigCentered(ctx, '★', STUB_CX, 37, GOLD)
  drawTextCentered(ctx, 'PIXEL', STUB_CX, 47, CREAM)
  drawTextCentered(ctx, 'BOOTH', STUB_CX, 54, CREAM)
}
```

Fields: `expires` default `'TODAY'`. Imports updated (`BLUE_MID, GOLD_DARK, GOLD_LIGHT`; `bevel, cornerOrnaments, dither, ring`; `drawBigCentered, drawTitle`; drop `drawBitmap`, `HEART`, `RED`, `fitScale` if unused).

- [ ] **Step 4: Run** `npx vitest run src/templates` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: redraw the voucher with a double border, value plate and seal`

---

### Task 6: Before/after renders and checks

- [ ] **Step 1:** Make a `main` worktree in the scratchpad (`git worktree add <scratch>/main-wt main`), run its dev server on 5198 and this branch on 5199; in each, evaluate in the page: import `/src/templates/registry.ts`, `/src/render/composeStamp.ts`, `/src/editions/registry.ts`, `/src/templates/placeholder.ts`, `/src/templates/fields.ts`; compose stamp, ticket and voucher at scale 6 with the placeholder photo (common and holo editions); save PNGs; combine before/after side by side.
- [ ] **Step 2:** Inspect each pair; fix anything that reads wrong (visual-only changes, tests stay green, ledger each as a ruling).
- [ ] **Step 3:** Publish the before/after images to the user for approval (HTML page or images in chat), download one PNG of each card from the app and check a stamp print preview.
- [ ] **Step 4:** Remove the worktree (`git worktree remove`), stop servers.
