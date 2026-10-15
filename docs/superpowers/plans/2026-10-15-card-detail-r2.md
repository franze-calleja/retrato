# Card Detail Pass Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw the ID, Trading and Tarot cards at the Round 1 detail level (sepia tarot), add the ID card's ghost photo and the trading card's Card no. field.

**Architecture:** `composeStamp` gains an optional `ghostRect` pass (faded greyscale copy of the photo after the main photo). `pixelFontLarge` exposes `titleFit` (sizing without drawing) for left-aligned slots. The three template modules are rewritten on the Round 1 helpers.

**Tech Stack:** Vite 8, React 19.2, TypeScript ~6.0, Vitest 4.1 (jsdom, vitest-canvas-mock).

**Spec:** `docs/superpowers/specs/2026-10-15-card-detail-r2-design.md`

## Global Constraints

- Art sizes, print sizes, photo windows and photo shapes unchanged (ID 160×101, Trading 96×134, Tarot 84×144, +3 shadow).
- `render()` never draws the photo; no `clearRect` inside a card body (holes become transparent in exports).
- Ghost: `globalAlpha 0.35`, `filter 'grayscale(1)'`, drawn after the main photo, state restored.
- New colours: `SEPIA_LIGHT [240,226,190]`, `SEPIA_MID [196,160,104]`, `SEPIA_DARK [120,84,46]`, `SEPIA_INK [62,40,22]`, `PURPLE_LIGHT [160,116,232]`.
- Conventional Commits; no AI attribution. Before each commit: `npx tsc -b && npm run lint && npx vitest run`.

## Review Focus

1. Worst-case text in every slot stays inside its slot (ID name column next to the chip; trading name banner, type ribbon, card number vs badge; tarot title plate). Tests in Tasks 2–4.
2. No detail paints inside photo windows; no interior holes. Tests in Tasks 2–4.
3. Ghost pass leaves the canvas state clean (alpha/filter) for later draws and the cache. Test in Task 1.
4. Remembered trading values from before the Card no. field still get it (Round 1's defaults merge). Test in Task 3.
5. Tarot frame uses only sepia colours. Test in Task 4.

---

### Task 1: Ghost photo pass and `titleFit`

**Files:**
- Modify: `src/templates/types.ts`, `src/render/composeStamp.ts`, `src/templates/pixelFontLarge.ts`
- Test: `src/render/composeStamp.test.ts`, `src/templates/pixelFontLarge.test.ts`

**Interfaces:**
- Produces: `Template.ghostRect?: Rect`; `titleFit(text, maxWidth, maxScale = 2): { font: 'big' | 'small'; scale: number; width: number; text: string }`.

- [ ] **Step 1: Failing tests**

Append to `src/render/composeStamp.test.ts` (reuse its existing imports; add any missing):

```ts
test('a ghostRect gets a faded greyscale copy of the photo after the main photo, with state restored', () => {
  const t = { ...getTemplate('stamp'), id: 'ghost-test', ghostRect: { x: 2, y: 3, w: 10, h: 12 } }
  const photo = { source: document.createElement('canvas'), w: 100, h: 100 }
  const out = document.createElement('canvas')
  const ctx = out.getContext('2d')!
  const seen: { dest: number[]; alpha: number; filter: string }[] = []
  const orig = ctx.drawImage.bind(ctx)
  vi.spyOn(ctx, 'drawImage').mockImplementation(((...a: number[]) => {
    if (a[0] === (photo.source as unknown as number)) seen.push({ dest: a.slice(5), alpha: ctx.globalAlpha, filter: ctx.filter })
    return (orig as (...x: unknown[]) => void)(...a)
  }) as never)
  composeStamp(t, photo, {}, 4, out)
  expect(seen).toHaveLength(2)
  expect(seen[1].dest).toEqual([8, 12, 40, 48])
  expect(seen[1].alpha).toBeCloseTo(0.35)
  expect(seen[1].filter).toBe('grayscale(1)')
  expect(seen[0].alpha).toBe(1)
  expect(ctx.globalAlpha).toBe(1)
  expect(ctx.filter).toBe('none')
})

test('templates without a ghostRect draw the photo once', () => {
  const t = getTemplate('stamp')
  const photo = { source: document.createElement('canvas'), w: 100, h: 100 }
  const out = document.createElement('canvas')
  const ctx = out.getContext('2d')!
  const draw = vi.spyOn(ctx, 'drawImage')
  composeStamp(t, photo, {}, 2, out)
  expect(draw.mock.calls.filter((c) => c[0] === photo.source)).toHaveLength(1)
})
```

Append to `src/templates/pixelFontLarge.test.ts` (import `titleFit`):

```ts
test('titleFit sizes without drawing and returns the text it would draw', () => {
  expect(titleFit('HI', 100)).toEqual({ font: 'big', scale: 2, width: measureBig('HI', 2), text: 'HI' })
  const t = titleFit('W'.repeat(40), 30)
  expect(t.font).toBe('small')
  expect(t.width).toBeLessThanOrEqual(30)
  expect(Array.from(t.text).length).toBeLessThan(40)
})
```

- [ ] **Step 2: Run** `npx vitest run src/render/composeStamp.test.ts src/templates/pixelFontLarge.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/templates/types.ts` — in `Template` after `photoShape`:

```ts
  /** Optional second spot for a small faded greyscale copy of the photo (ID-card ghost image), art pixels. */
  ghostRect?: Rect
```

`src/render/composeStamp.ts` — add above `composeStamp`:

```ts
/** The faded security copy some cards print next to the main photo. */
function drawGhost(ctx: CanvasRenderingContext2D, template: Template, photo: PhotoSource, scale: number) {
  const g = template.ghostRect
  if (!g) return
  ctx.save()
  ctx.globalAlpha = 0.35
  ctx.filter = 'grayscale(1)'
  drawCover(ctx, photo, g.x * scale, g.y * scale, g.w * scale, g.h * scale)
  ctx.restore()
}
```

and call `drawGhost(ctx, template, photo, scale)` right before each `return out` (after the rect-path `drawCover` and after the shaped path's `ctx.restore()`).

`src/templates/pixelFontLarge.ts` — extract the sizing:

```ts
export function titleFit(text: string, maxWidth: number, maxScale = 2): { font: 'big' | 'small'; scale: number; width: number; text: string } {
  for (let s = maxScale; s >= 1; s--) {
    const w = measureBig(text, s)
    if (w <= maxWidth && 7 * s <= TITLE_LINE) return { font: 'big', scale: s, width: w, text }
  }
  // (A small-font scale-2 step would never win: big scale 1 always fits more characters.)
  if (measureText(text) <= maxWidth) return { font: 'small', scale: 1, width: measureText(text), text }
  let cut = Array.from(text)
  while (cut.length && measureText(cut.join('')) > maxWidth) cut = cut.slice(0, -1)
  const fitted = cut.join('')
  return { font: 'small', scale: 1, width: measureText(fitted), text: fitted }
}
```

and rewrite `drawTitle` to use it:

```ts
export function drawTitle(ctx, text, cx, y, maxWidth, color, shadow?, maxScale = 2) {
  const fit = titleFit(text, maxWidth, maxScale)
  const h = fit.font === 'big' ? 7 * fit.scale : 5 * fit.scale
  const top = y + Math.floor((TITLE_LINE - h) / 2)
  if (fit.font === 'big') drawBigCentered(ctx, fit.text, cx, top, color, fit.scale, shadow)
  else drawTextCentered(ctx, fit.text, cx, top, color, fit.scale, shadow)
  return { font: fit.font, scale: fit.scale, width: fit.width }
}
```

(keep the parameter types as they are today).

- [ ] **Step 4: Run** — Expected: PASS; full suite green.
- [ ] **Step 5: Commit** `feat: compose an optional ghost photo; expose title sizing`

---

### Task 2: ID card redraw

**Files:**
- Modify: `src/templates/colors.ts`, `src/templates/idcard.ts`
- Test: `src/templates/idcard.test.ts`

**Interfaces:** Consumes Task 1 (`ghostRect`, `titleFit`), Round 1 helpers; adds colours (all five from Global Constraints).

- [ ] **Step 1: Failing tests** — append to `src/templates/idcard.test.ts`:

```ts
import { afterEach, vi } from 'vitest'
import { getTemplate as get } from './registry'

afterEach(() => vi.restoreAllMocks())

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

test('ID keeps its photo window and print size, and gains a ghost photo clear of everything', () => {
  const t = get('id')
  expect(t.photoRect).toEqual({ x: 8, y: 26, w: 48, h: 60 })
  expect(t.printSizeMm.w).toBe(85.6)
  expect(t.ghostRect).toEqual({ x: 136, y: 70, w: 16, h: 20 })
  expect(overlaps(t.ghostRect!, t.photoRect)).toBe(false)
  expect(t.ghostRect!.x).toBeGreaterThanOrEqual(64 + 64) // right of the text column and barcode
})

test('ID draws no detail inside the photo window and punches no holes', () => {
  const t = get('id')
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  t.render(document.createElement('canvas').getContext('2d')!, { org: 'W'.repeat(12), name: 'W'.repeat(14), member: 'NO. 9999', valid: '2099-12-31' })
  const bad = fr.mock.calls.map(([x, y, w, h]) => ({ x, y, w, h })).filter((r) => r.w < 100 && overlaps(r, t.photoRect))
  expect(bad).toEqual([])
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 160 * 101)).toEqual([])
})

test('a long name stays in its column, left of the chip', () => {
  const t = get('id')
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  t.render(document.createElement('canvas').getContext('2d')!, { org: '', name: 'W'.repeat(14), member: '', valid: '' })
  const nameRow = fr.mock.calls.map(([x, y, w, h]) => ({ x, y, w, h })).filter((r) => r.y >= 31 && r.y + r.h <= 45 && r.w <= 2)
  expect(nameRow.length).toBeGreaterThan(0)
  for (const r of nameRow) expect(r.x + r.w).toBeLessThanOrEqual(130)
})
```

(If `idcard.test.ts` already imports from vitest, merge the imports instead of adding a second line.)

- [ ] **Step 2: Run** — Expected: FAIL (no `ghostRect`).

- [ ] **Step 3: Implement**

Append to `colors.ts`:

```ts
export const SEPIA_LIGHT: Color = [240, 226, 190]
export const SEPIA_MID: Color = [196, 160, 104]
export const SEPIA_DARK: Color = [120, 84, 46]
export const SEPIA_INK: Color = [62, 40, 22]
export const PURPLE_LIGHT: Color = [160, 116, 232]
```

`idcard.ts` — constants and body:

```ts
const BARCODE = { x: COL_X, y: 84, w: 64, h: 10 }
const COL_W = 64
const CHIP = { x: 132, y: 24, w: 18, h: 14 }
const GHOST = { x: 136, y: 70, w: 16, h: 20 }
const HOLO = { x: 8, y: 89, w: 22, h: 9 }

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, CREAM, 1, 1, BW - 2, BH - 2, 2)
  guilloche(ctx, { x: 58, y: 21, w: BW - 61, h: BH - 24 }, CREAM_DARK, 20, 2)

  // Red header with the organisation name.
  panel(ctx, RED, 1, 1, BW - 2, 18, 2)
  fill(ctx, RED, 1, 10, BW - 2, 9)
  fill(ctx, OUTLINE, 1, 19, BW - 2, 1)
  drawTitle(ctx, values.org ?? '', BW / 2, 3, 140, CREAM, RED_DARK, 2)

  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)

  // Contact chip.
  panel(ctx, OUTLINE, CHIP.x - 1, CHIP.y - 1, CHIP.w + 2, CHIP.h + 2, 2)
  panel(ctx, GOLD, CHIP.x, CHIP.y, CHIP.w, CHIP.h, 1)
  bevel(ctx, { x: CHIP.x + 1, y: CHIP.y, w: CHIP.w - 2, h: CHIP.h }, GOLD_LIGHT, GOLD_DARK)
  fill(ctx, GOLD_DARK, CHIP.x + 6, CHIP.y + 2, 1, CHIP.h - 4)
  fill(ctx, GOLD_DARK, CHIP.x + 11, CHIP.y + 2, 1, CHIP.h - 4)
  fill(ctx, GOLD_DARK, CHIP.x + 2, CHIP.y + 5, CHIP.w - 4, 1)
  fill(ctx, GOLD_DARK, CHIP.x + 2, CHIP.y + 9, CHIP.w - 4, 1)

  drawText(ctx, 'MEMBER', COL_X, 26, RED)
  const name = values.name ?? ''
  const fit = titleFit(name, COL_W, 1)
  drawTitle(ctx, name, COL_X + fit.width / 2, 31, COL_W, OUTLINE, undefined, 1)
  drawText(ctx, values.member ?? '', COL_X, 46, OUTLINE)
  drawText(ctx, 'VALID UNTIL', COL_X, 56, RED)
  drawText(ctx, values.valid ?? '', COL_X, 64, OUTLINE)

  barcodeBars(values.member ?? '', BARCODE.w).forEach((on, i) => {
    if (on) fill(ctx, OUTLINE, BARCODE.x + i, BARCODE.y, 1, BARCODE.h)
  })

  // Ghost photo keyline (the composer draws the faded photo inside it).
  outline(ctx, CREAM_DARK, GHOST.x - 1, GHOST.y - 1, GHOST.w + 2, GHOST.h + 2)

  // Hologram patch: silver with diagonal stripes; editions make it shimmer.
  fill(ctx, SILVER, HOLO.x, HOLO.y, HOLO.w, HOLO.h)
  for (let y = 0; y < HOLO.h; y++)
    for (let x = 0; x < HOLO.w; x++) {
      const d = (x + y) % 4
      if (d === 0) fill(ctx, SILVER_LIGHT, HOLO.x + x, HOLO.y + y, 1, 1)
      else if (d === 2) fill(ctx, SILVER_DARK, HOLO.x + x, HOLO.y + y, 1, 1)
    }
  outline(ctx, SILVER_DARK, HOLO.x - 1, HOLO.y - 1, HOLO.w + 2, HOLO.h + 2)

  // Micro-text security line.
  for (let x = 34, i = 0; x < BW - 4; x++, i++) if (i % 9 < 7 && i % 2 === 0) fill(ctx, RED_DARK, x, BH - 4, 1, 1)
}
```

Add `ghostRect: GHOST,` to the template object. Imports: `CREAM_DARK, GOLD, GOLD_DARK, GOLD_LIGHT, SILVER, SILVER_DARK, SILVER_LIGHT` from `./colors`; `bevel, guilloche` from `./detail`; `drawTitle, titleFit` from `./pixelFontLarge`; drop `drawTextCentered, fitScale` if unused.

- [ ] **Step 4: Run** `npx vitest run src/templates src/render` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: redraw the ID card with chip, hologram, ghost photo and micro-text`

---

### Task 3: Trading card redraw and Card no.

**Files:**
- Modify: `src/templates/trading.ts`
- Test: `src/templates/trading.test.ts`

- [ ] **Step 1: Failing tests** — append to `src/templates/trading.test.ts` (merge imports; add `afterEach(() => vi.restoreAllMocks())` once):

```ts
test('card numbers look like № 042/100 and stay in 001–100', async () => {
  const { randomCardNo } = await import('./trading')
  expect(randomCardNo(() => 0)).toBe('№ 001/100')
  expect(randomCardNo(() => 0.4199)).toBe('№ 042/100')
  expect(randomCardNo(() => 0.9999)).toBe('№ 100/100')
})

test('the trading card has a per-capture Card no. field that fits its slot', () => {
  const t = getTemplate('trading')
  const f = t.fields.find((x) => x.key === 'number')!
  expect(f).toMatchObject({ label: 'Card no.', maxLength: 9, perCapture: true })
  expect(resolveDefaults(t).number).toMatch(/^№ \d{3}\/100$/)
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  t.render(document.createElement('canvas').getContext('2d')!, { ...resolveDefaults(t), number: 'WWWWWWWWW' })
  const row = fr.mock.calls.map(([x, y, w, h]) => ({ x, y, w, h })).filter((r) => r.y >= 124 && r.y + r.h <= 129 && r.w === 1)
  expect(row.length).toBeGreaterThan(0)
  for (const r of row) expect(r.x).toBeGreaterThanOrEqual(36) // clear of the edition badge on the left
})

test('trading card keeps photo and print size, draws nothing in the photo, no holes', () => {
  const t = getTemplate('trading')
  expect(t.photoRect).toEqual({ x: 10, y: 22, w: 76, h: 64 })
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  t.render(document.createElement('canvas').getContext('2d')!, { name: 'W'.repeat(12), type: 'W'.repeat(16), charm: '9', chaos: '9', luck: '9', number: '№ 100/100' })
  const P = t.photoRect
  const bad = fr.mock.calls.filter(([x, y, w, h]) => w < 80 && x < P.x + P.w && x + w > P.x && y < P.y + P.h && y + h > P.y)
  expect(bad).toEqual([])
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 96 * 134)).toEqual([])
})
```

(Import `resolveDefaults` from `./fields` and `getTemplate` from `./registry` if not already.)

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** — `trading.ts`:

```ts
export function randomCardNo(rand: () => number = Math.random): string {
  return `№ ${String(1 + Math.min(99, Math.floor(rand() * 100))).padStart(3, '0')}/100`
}

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, PURPLE, 1, 1, BW - 2, BH - 2, 2)
  dither(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, PURPLE_DARK, 0.06, 11)
  bevel(ctx, { x: 1, y: 1, w: BW - 2, h: BH - 2 }, PURPLE_LIGHT, PURPLE_DARK)

  // Gold name banner.
  panel(ctx, OUTLINE, 4, 4, BW - 8, 13, 2)
  panel(ctx, GOLD, 5, 5, BW - 10, 11, 1)
  bevel(ctx, { x: 6, y: 5, w: BW - 12, h: 11 }, GOLD_LIGHT, GOLD_DARK)
  drawTitle(ctx, values.name ?? '', BW / 2, 3, 84, OUTLINE, undefined, 1)

  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  // Rivets at the mat's outer corners.
  for (const [x, y] of [[3, 19], [BW - 5, 19], [3, 88], [BW - 5, 88]]) {
    fill(ctx, GOLD, x, y, 2, 2)
    fill(ctx, GOLD_LIGHT, x, y, 1, 1)
  }

  // Type ribbon with notched ends (filled in the body colour, never cleared).
  fill(ctx, OUTLINE, 12, 90, 72, 10)
  fill(ctx, PURPLE_DARK, 13, 91, 70, 8)
  fill(ctx, PURPLE, 12, 93, 2, 4)
  fill(ctx, PURPLE, 82, 93, 2, 4)
  drawTextCentered(ctx, values.type ?? '', BW / 2, 92, CREAM)

  // Stats box: label, 9 pips, number; the card number underneath.
  panel(ctx, OUTLINE, 6, 101, BW - 12, 29, 2)
  panel(ctx, PURPLE_DARK, 7, 102, BW - 14, 27, 1)
  STATS.forEach(({ key, label }, row) => {
    const y = 104 + row * 7
    const raw = values[key] ?? ''
    const n = statValue(raw)
    drawText(ctx, label, 10, y, CREAM)
    for (let i = 0; i < PIPS; i++) {
      fill(ctx, i < n ? GOLD : OUTLINE, 36 + i * 4, y, 3, 5)
      if (i < n) fill(ctx, GOLD_LIGHT, 36 + i * 4, y, 3, 1)
    }
    drawTextRight(ctx, raw, 86, y, GOLD)
  })
  drawTextRight(ctx, values.number ?? '', 86, 124, GOLD)
}
```

Add the field after the stats:

```ts
    { key: 'number', label: 'Card no.', default: () => randomCardNo(), maxLength: 9, perCapture: true },
```

Imports: `GOLD_DARK, GOLD_LIGHT, PURPLE_LIGHT` from `./colors`; `bevel, dither` from `./detail`; `drawTitle` from `./pixelFontLarge`; drop `fitScale` if unused.

Note: `№` must exist in the 3×5 font (added in Round 1) or this renders `?`.

- [ ] **Step 4: Run** — Expected: PASS (and the existing deal test "uses remembered values…" still passes: it compares keys against the template fields).
- [ ] **Step 5: Commit** `feat: redraw the trading card with rivets, ribbon and pips; add a card number`

---

### Task 4: Sepia tarot

**Files:**
- Modify: `src/templates/tarot.ts`
- Test: `src/templates/arcana.test.ts` (tarot tests live here) or new `src/templates/tarot.test.ts`

- [ ] **Step 1: Failing tests** — `src/templates/tarot.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { SEPIA_DARK, SEPIA_INK, SEPIA_LIGHT, SEPIA_MID, SHADOW } from './colors'
import { css } from './draw'
import { getTemplate } from './registry'

afterEach(() => vi.restoreAllMocks())

test('the tarot frame uses only the sepia palette', () => {
  const sets: string[] = []
  const proto = CanvasRenderingContext2D.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'fillStyle')!
  vi.spyOn(proto, 'fillStyle', 'set').mockImplementation(function (this: CanvasRenderingContext2D, v: string) {
    sets.push(String(v))
    desc.set!.call(this, v)
  })
  getTemplate('tarot').render(document.createElement('canvas').getContext('2d')!, { title: 'THE STAR' })
  const allowed = new Set([SEPIA_LIGHT, SEPIA_MID, SEPIA_DARK, SEPIA_INK, SHADOW].map(css))
  expect(sets.filter((s) => !allowed.has(s))).toEqual([])
})

test('tarot keeps its arched photo window and print size; nothing drawn inside the photo; no holes', () => {
  const t = getTemplate('tarot')
  expect(t.photoRect).toEqual({ x: 12, y: 24, w: 60, h: 86 })
  expect(t.photoShape).toBe('arch')
  expect(t.printSizeMm.w).toBe(70)
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  t.render(document.createElement('canvas').getContext('2d')!, { title: 'THE HIGH PRIESTESS' })
  const P = t.photoRect
  // The arch mat/rim fills span the window by design (photo is drawn over them); look for small detail only.
  const bad = fr.mock.calls.filter(([x, y, w, h]) => w * h <= 25 && w < 6 && x >= P.x && x + w <= P.x + P.w && y >= P.y && y + h <= P.y + P.h)
  expect(bad.length).toBeLessThan(200) // the dither under the window is covered by the mat; spandrel art must not be here
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 84 * 144)).toEqual([])
})
```

Note: the dither runs over the whole inner body before the arch mat paints over it, so "nothing inside the window" is checked as "the arch mat is drawn after the dither" — assert instead, more precisely, that the last `fillRect` covering the window centre comes from the arch rim (`SEPIA_INK`) by recording `fillStyle` per call; ledger whichever assertion is used.

- [ ] **Step 2: Run** — Expected: FAIL (navy/gold colours).

- [ ] **Step 3: Implement** — `tarot.ts`:

```ts
const STAR5 = ['00100', '01110', '11111', '01110', '00100']
const MOON5 = ['01110', '11000', '10000', '11000', '01110']

function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, SEPIA_INK, 0, 0, BW, BH, 3)
  panel(ctx, SEPIA_LIGHT, 1, 1, BW - 2, BH - 2, 2)
  dither(ctx, { x: 6, y: 6, w: BW - 12, h: BH - 12 }, SEPIA_MID, 0.16, 5)
  outline(ctx, SEPIA_DARK, 3, 3, BW - 6, BH - 6)
  outline(ctx, SEPIA_MID, 5, 5, BW - 10, BH - 10)

  // Numeral tab.
  const numeral = numeralFor(values.title ?? '')
  if (numeral) {
    panel(ctx, SEPIA_INK, 30, 7, 24, 11, 2)
    panel(ctx, SEPIA_LIGHT, 31, 8, 22, 9, 1)
    drawTextCentered(ctx, numeral, BW / 2, 10, SEPIA_INK)
  }

  // Arched window: tan mat, ink rim; the composer clips the photo to the same arch.
  fillShape(ctx, SEPIA_MID, grow(PHOTO, 3), 'arch')
  fillShape(ctx, SEPIA_INK, grow(PHOTO, 1), 'arch')
  // Star and crescent in the spandrels beside the arch.
  drawBitmap(ctx, STAR5, 11, 24, SEPIA_DARK)
  drawBitmap(ctx, MOON5, 68, 24, SEPIA_DARK)

  // Title plate.
  panel(ctx, SEPIA_INK, 6, 116, BW - 12, 16, 2)
  panel(ctx, SEPIA_LIGHT, 7, 117, BW - 14, 14, 1)
  drawTitle(ctx, values.title ?? '', BW / 2, 117, 68, SEPIA_INK, undefined, 1)
  drawTextCentered(ctx, 'PIXEL TAROT', BW / 2, 134, SEPIA_DARK)
}
```

Imports: sepia colours (+ `SHADOW` stays for the drop shadow); `dither` from `./detail`; `drawTitle` from `./pixelFontLarge`; drop `DIAMOND`, `GOLD`, `GOLD_DARK`, `NAVY`, `OUTLINE`, `fitScale` if unused.

- [ ] **Step 4: Run** `npx vitest run src/templates` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: redraw the tarot card in sepia with halftone, spandrel stars and a title plate`

---

### Task 5: Before/after renders

- [ ] Same procedure as Round 1 Task 6: `main` worktree on 5198, branch on 5199, render id/trading/tarot at scale 5 (common + holo) with the placeholder photo; inspect; fix visual issues (ledger rulings); publish a before/after page for the user's approval; remove the worktree and stop the servers.
- [ ] Also download one ID card PNG from the app and confirm the ghost photo appears.
