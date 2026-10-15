# Card Detail Pass Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Joker card with classic/full-art layouts and an editor Layout picker, teal Planet card, illustrated packs.

**Architecture:** Templates gain optional `variant(values)` (layout-dependent photo rect, badge, render, overlay), `overlay` (art drawn after the photo) and field `options` (rendered as a select). `resolveTemplate` applies the variant; `composeStamp` resolves, draws the overlay last and routes the edition badge onto it. Booth keeps uncropped captures for variant templates.

**Tech Stack:** Vite 8, React 19.2, TypeScript ~6.0, Zustand 5, Vitest 4.1 (jsdom, vitest-canvas-mock).

**Spec:** `docs/superpowers/specs/2026-10-15-card-detail-r3-design.md`

## Global Constraints

- Internal ids unchanged (`jester` template and pack); user-visible names become "Joker".
- Art sizes and print sizes unchanged for every card and pack.
- No `clearRect` inside a card body; frame details via `fill`/`fillRect`.
- `CARD_WHITE [250, 247, 240]`, `PINK [242, 120, 170]`, `TEAL [92, 172, 178]`, `TEAL_LIGHT [168, 222, 222]`, `TEAL_DARK [36, 96, 108]`, `TEAL_INK [18, 52, 62]`.
- Joker layouts: `sunburst`, `stripes`, `stars`, `halftone`, `fullart`; `rollJokerLayout`: `< 0.25 → fullart`, else classic uniformly.
- Conventional Commits; no AI attribution. Before each commit: `npx tsc -b && npm run lint && npx vitest run`.

## Review Focus

1. Switching the Joker layout in the editor after capture must not over-crop the photo (capture kept uncropped for variant templates). Test in Task 2.
2. The edition badge is never hidden under a full-art photo (drawn on the overlay). Test in Task 1.
3. Templates without variant/overlay/options behave exactly as before (existing composeStamp/editor tests stay green; explicit identity test). Task 1.
4. Long names/effects fit every Joker layout and the Planet pill/footer. Tests in Tasks 3–4.
5. No user-visible "Jester" remains. Test in Task 3.

## Plan-level rulings (from writing the code)

- Full-art banner is `{ x: 6, y: 100, w: 76, h: 24 }` (spec said 84 wide) so it clears the bottom-right corner plate (x 84–93).
- Pack illustrations are small draw functions (`illustration(ctx, cx, top)`) instead of palette-indexed bitmaps: crisper shapes from the existing primitives (panels, circles), easier to tune; tests check they draw inside their area.

---

### Task 1: Engine — variants, overlay, field options, vertical text direction

**Files:**
- Modify: `src/templates/types.ts`, `src/render/composeStamp.ts`, `src/editions/apply.ts`, `src/templates/detail.ts`
- Create: `src/templates/resolve.ts`
- Test: `src/templates/resolve.test.ts`, `src/render/composeStamp.test.ts`, `src/templates/detail.test.ts`

**Interfaces:**
- Produces: `FieldOption`, `TemplateField.options?`, `TemplateVariant`, `Template.variant?`, `Template.overlay?`; `resolveTemplate(t, values)`; `applyEdition(ctx, edition, w, h, angle, badgeAt?, opts?: { badge?: boolean })`; `drawTextVertical(ctx, text, x, y, color, font, shadow?, dir: 'up' | 'down' = 'up')`.

- [ ] **Step 1: Failing tests**

`src/templates/resolve.test.ts`:

```ts
import { expect, test } from 'vitest'
import { getTemplate } from './registry'
import { resolveTemplate } from './resolve'
import type { Template, TemplateVariant } from './types'

test('templates without a variant resolve to themselves', () => {
  const t = getTemplate('stamp')
  expect(resolveTemplate(t, {})).toBe(t)
})

test('a variant overrides fields and keeps a stable identity for the same variant', () => {
  const a: TemplateVariant = { photoRect: { x: 1, y: 2, w: 3, h: 4 } }
  const b: TemplateVariant = { photoRect: { x: 5, y: 6, w: 7, h: 8 } }
  const t: Template = { ...getTemplate('stamp'), id: 'variant-test', variant: (v) => (v.k === 'b' ? b : a) }
  const ra = resolveTemplate(t, { k: 'a' })
  expect(ra.photoRect).toEqual({ x: 1, y: 2, w: 3, h: 4 })
  expect(resolveTemplate(t, { k: 'a' })).toBe(ra)
  expect(resolveTemplate(t, { k: 'b' }).photoRect).toEqual({ x: 5, y: 6, w: 7, h: 8 })
})
```

Append to `src/render/composeStamp.test.ts`:

```ts
test('an overlay is drawn after the photo, and the edition badge goes on the overlay', async () => {
  const apply = await import('../editions/apply')
  const spy = vi.spyOn(apply, 'applyEdition')
  const overlay = vi.fn((ctx: CanvasRenderingContext2D) => ctx.fillRect(0, 0, 1, 1))
  const t = { ...getTemplate('stamp'), id: 'overlay-test', overlay }
  const p = { source: document.createElement('canvas'), w: 100, h: 100 }
  const out = document.createElement('canvas')
  const ctx = out.getContext('2d')!
  const order: string[] = []
  vi.spyOn(ctx, 'drawImage').mockImplementation(((src: unknown) => {
    order.push(src === p.source ? 'photo' : 'art')
  }) as never)
  composeStamp(t, p, {}, 2, out, { edition: getEdition('holo'), angle: 0.35 })
  expect(overlay).toHaveBeenCalled()
  expect(order).toEqual(['art', 'photo', 'art'])
  const badges = spy.mock.calls.map((c) => c[6]?.badge)
  expect(badges).toEqual([false, true]) // frame: no badge; overlay: badge
  spy.mockRestore()
})

test('without an overlay the frame still carries the badge', async () => {
  const apply = await import('../editions/apply')
  const spy = vi.spyOn(apply, 'applyEdition')
  const t = { ...getTemplate('stamp'), id: 'no-overlay-test' }
  composeStamp(t, { source: document.createElement('canvas'), w: 10, h: 10 }, {}, 1, undefined, { edition: getEdition('foil'), angle: 0.35 })
  expect(spy.mock.calls.map((c) => c[6]?.badge ?? true)).toEqual([true])
  spy.mockRestore()
})
```

Append to `src/templates/detail.test.ts`:

```ts
test('vertical text can read downward (playing-card corner index)', () => {
  const c = document.createElement('canvas').getContext('2d')!
  const tf = vi.spyOn(c, 'transform')
  drawTextVertical(c, 'JOKER', 8, 5, C, 'small', undefined, 'down')
  expect(tf).toHaveBeenCalledWith(0, 1, -1, 0, 8, 5)
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`types.ts`:

```ts
export interface FieldOption {
  value: string
  label: string
}
```

`TemplateField` gains `/** Render as a select with these choices. */ options?: readonly FieldOption[]`.

`Template` gains:

```ts
  /** Layout-dependent overrides (e.g. the Joker's layouts), chosen from the card's values. */
  variant?(values: Record<string, string>): TemplateVariant
  /** Art drawn over the photo (full-art layouts), at art scale. */
  overlay?(ctx: CanvasRenderingContext2D, values: Record<string, string>): void
```

and after the interface:

```ts
export type TemplateVariant = Partial<Pick<Template, 'photoRect' | 'photoShape' | 'badgeAt' | 'ghostRect' | 'render' | 'overlay'>>
```

`src/templates/resolve.ts`:

```ts
import type { Template, TemplateVariant } from './types'

// One resolved template per template id and variant object, so identities stay stable between frames.
const memo = new Map<string, { variant: TemplateVariant; template: Template }>()

export function resolveTemplate(t: Template, values: Record<string, string>): Template {
  if (!t.variant) return t
  const variant = t.variant(values)
  const hit = memo.get(t.id)
  if (hit?.variant === variant) return hit.template
  const template = { ...t, ...variant }
  memo.set(t.id, { variant, template })
  return template
}
```

`apply.ts` — `applyEdition(..., badgeAt?: BadgeAnchor, opts: { badge?: boolean } = {})` and `if (edition.badge && opts.badge !== false) drawBadge(...)`.

`composeStamp.ts`:
- Rename the parameter to `base` and start with `const template = resolveTemplate(base, values)`.
- `frameArt`: call `applyEdition(ctx, edition, canvas.width, canvas.height, angle, template.badgeAt, { badge: !template.overlay })`.
- Add an overlay cache and builder mirroring `frameArt`:

```ts
const overlayCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>()

function overlayArt(template: Template, values: Record<string, string>, opts: ComposeOptions): HTMLCanvasElement {
  const edition = opts.edition
  const angle = edition?.hasEffect ? quantizeAngle(opts.angle ?? 0) : 0
  const key = JSON.stringify([template.fields.map((f) => values[f.key] ?? null), edition?.id ?? null, angle])
  const cached = overlayCache.get(template.id)
  if (cached?.key === key) return cached.canvas
  const canvas = document.createElement('canvas')
  canvas.width = template.size.w
  canvas.height = template.size.h
  const ctx = canvas.getContext('2d')!
  template.overlay!(ctx, values)
  if (edition) applyEdition(ctx, edition, canvas.width, canvas.height, angle, template.badgeAt, { badge: true })
  overlayCache.set(template.id, { key, canvas })
  return canvas
}
```

- Replace the photo section's early return so every path ends with:

```ts
  drawGhost(ctx, template, photo, scale)
  if (template.overlay) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(overlayArt(template, values, opts), 0, 0, out.width, out.height)
  }
  return out
```

`detail.ts` — `drawTextVertical(..., shadow?: Color, dir: 'up' | 'down' = 'up')`: `if (dir === 'up') ctx.transform(0, -1, 1, 0, x, y) else ctx.transform(0, 1, -1, 0, x, y)`; doc: `down` reads top to bottom, its column lies left of `x` (x−thickness … x−1), rows y … y+length−1.

- [ ] **Step 4: Run** — Expected: PASS; full suite green.
- [ ] **Step 5: Commit** `feat: template variants, overlay layer and field options in the renderer`

---

### Task 2: Editor select and variant-aware booth

**Files:**
- Modify: `src/screens/Editor.tsx`, `src/screens/Booth.tsx`
- Test: `src/screens/Editor.test.tsx`, `src/screens/Booth.test.tsx`

- [ ] **Step 1: Failing tests**

`Editor.test.tsx`:

```tsx
test('a field with options is a select that sets the value', () => {
  const t = { ...getTemplate('stamp') }
  const fields = [...t.fields, { key: 'mood', label: 'Mood', default: 'a', maxLength: 4, options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] }]
  const spy = vi.spyOn(registry, 'getTemplate').mockReturnValue({ ...t, fields } as never)
  open(true)
  const select = screen.getByLabelText('Mood') as HTMLSelectElement
  expect(select.tagName).toBe('SELECT')
  fireEvent.change(select, { target: { value: 'b' } })
  expect(useBooth.getState().values.mood).toBe('b')
  spy.mockRestore()
})
```

(Import `* as registry from '../templates/registry'`. If ESM spying on `getTemplate` does not intercept the Editor's import, run this test after Task 3 against the real Joker template instead — select `Layout`, choose `Full art` — and ledger it.)

`Booth.test.tsx`:

```tsx
test('captures for cards with layouts keep the whole frame so any layout can crop it', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const t = getTemplate('stamp')
  const spy = vi.spyOn(registry, 'getTemplate').mockImplementation((id) => (id === 'stamp' ? ({ ...t, variant: () => ({}) } as never) : t))
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  render(<Booth />)
  await uploadInto()
  for (const ms of [150, 900, 1200, 450]) act(() => { vi.advanceTimersByTime(ms) })
  expect(useBooth.getState().capture!.w).toBe(800) // uncropped frozen frame, not the photo window
  spy.mockRestore()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})
```

(Same fallback as above: after Task 3 this can use the real `jester` template; ledger if so.)

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`Editor.tsx` field rendering:

```tsx
        {template.fields.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.options ? (
              <select value={values[f.key] ?? f.options[0].value} onChange={(e) => setValue(f.key, e.target.value)}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input … unchanged … />
            )}
          </label>
        ))}
```

plus CSS `.fields select` styled like `.fields input` (same font stack, padding, colours).

`Booth.tsx`:
- Read `const values = useBooth((s) => s.values)`; `const template = mode === 'pack' ? packViewfinder(getPack(packId)) : resolveTemplate(getTemplate(templateId), values)`.
- In `keep`, before cropping: `if (getTemplate(templateId).variant) return setCapture(photo) // keep the whole (frozen) frame: the layout can change in the editor`.

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: render option fields as selects; keep whole captures for cards with layouts`

---

### Task 3: Joker card

**Files:**
- Modify: `src/templates/jester.ts`, `src/templates/colors.ts`, `src/packs/catalog.ts` (name/description only here), tests referencing Jester names
- Test: `src/templates/joker.test.ts` (new), `src/templates/arcana.test.ts`, `src/screens/Shop.test.tsx`

- [ ] **Step 1: Failing tests** — `src/templates/joker.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { PACKS } from '../packs/catalog'
import { resolveDefaults } from './fields'
import { JOKER_LAYOUTS, rollJokerLayout } from './jester'
import { getTemplate, templates } from './registry'
import { resolveTemplate } from './resolve'

afterEach(() => vi.restoreAllMocks())
const joker = () => getTemplate('jester')
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

test('the Jester card is now the Joker card, everywhere users see it', () => {
  expect(joker().name).toBe('Joker Card')
  expect(resolveDefaults(joker()).name).toBe('JOKER')
  const visible = [...templates.flatMap((t) => [t.name, t.description]), ...PACKS.flatMap((p) => [p.name, p.description])]
  expect(visible.filter((s) => /jester/i.test(s))).toEqual([])
  expect(PACKS.find((p) => p.id === 'jester')!.name).toBe('Joker Pack')
})

test('layouts roll full art a quarter of the time, else a classic theme', () => {
  expect(rollJokerLayout(() => 0)).toBe('fullart')
  expect(rollJokerLayout(() => 0.2499)).toBe('fullart')
  expect(rollJokerLayout(() => 0.25)).toBe('sunburst')
  expect(rollJokerLayout(() => 0.5)).toBe('stripes')
  expect(rollJokerLayout(() => 0.75)).toBe('stars')
  expect(rollJokerLayout(() => 0.9999)).toBe('halftone')
})

test('the layout is a per-capture select with all five layouts', () => {
  const f = joker().fields.find((x) => x.key === 'layout')!
  expect(f.perCapture).toBe(true)
  expect(f.options!.map((o) => o.value)).toEqual(['sunburst', 'stripes', 'stars', 'halftone', 'fullart'])
  expect(JOKER_LAYOUTS.map((o) => o.label)).toEqual(['Sunburst', 'Stripes', 'Starfield', 'Halftone', 'Full art'])
})

test('classic and full-art photo windows; badge top-right; unknown layout → sunburst', () => {
  const classic = resolveTemplate(joker(), { layout: 'stars' })
  const full = resolveTemplate(joker(), { layout: 'fullart' })
  expect(classic.photoRect).toEqual({ x: 18, y: 16, w: 60, h: 64 })
  expect(full.photoRect).toEqual({ x: 4, y: 4, w: 88, h: 124 })
  expect(full.overlay).toBeTypeOf('function')
  expect(classic.overlay).toBeUndefined()
  for (const t of [classic, full]) expect(t.badgeAt).toEqual({ x: 95, y: 0, align: 'right' })
  expect(resolveTemplate(joker(), { layout: 'nope' }).photoRect).toEqual(classic.photoRect)
})

test.each(['sunburst', 'stripes', 'stars', 'halftone'])('%s: theme and text never paint over the photo, no holes', (layout) => {
  const t = resolveTemplate(joker(), { layout })
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  t.render(document.createElement('canvas').getContext('2d')!, { name: 'W'.repeat(12), effect: 'W'.repeat(36), layout })
  const mat = fr.mock.calls.findIndex(([x, y, w, h]) => x === 15 && y === 14 && w === 66 && h === 68)
  expect(mat).toBeGreaterThan(0)
  const bad = fr.mock.calls.slice(mat + 1).filter(([x, y, w, h]) => w * h < 96 * 132 && overlaps({ x, y, w, h }, t.photoRect))
  expect(bad).toEqual([])
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 96 * 132)).toEqual([])
})

test('full art: the overlay only covers the corner plates and the bottom banner', () => {
  const t = resolveTemplate(joker(), { layout: 'fullart' })
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  t.overlay!(document.createElement('canvas').getContext('2d')!, { name: 'W'.repeat(12), effect: 'W'.repeat(36), layout: 'fullart' })
  const allowed = [{ x: 2, y: 2, w: 10, h: 25 }, { x: 84, y: 105, w: 10, h: 25 }, { x: 6, y: 100, w: 76, h: 24 }]
  for (const [x, y, w, h] of fr.mock.calls)
    expect(allowed.some((a) => x >= a.x && y >= a.y && x + w <= a.x + a.w && y + h <= a.y + a.h)).toBe(true)
})
```

Update `arcana.test.ts` (`JESTER_EFFECTS` → `JOKER_EFFECTS`) and `Shop.test.tsx` (`'Jester Pack'` → `'Joker Pack'`).

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** — colours (append to `colors.ts`):

```ts
export const CARD_WHITE: Color = [250, 247, 240]
export const PINK: Color = [242, 120, 170]
export const TEAL: Color = [92, 172, 178]
export const TEAL_LIGHT: Color = [168, 222, 222]
export const TEAL_DARK: Color = [36, 96, 108]
export const TEAL_INK: Color = [18, 52, 62]
```

`jester.ts` (full rewrite; file name and id stay):

```ts
import { BLUE, CARD_WHITE, CREAM, CREAM_DARK, GOLD, NAVY, OUTLINE, PINK, PURPLE, RED, RED_DARK, SHADOW } from './colors'
import { dither, drawTextVertical } from './detail'
import { css, fill, outline, panel, withDropShadow } from './draw'
import { drawTextCentered, wrapText } from './pixelFont'
import { drawTitle, titleFit } from './pixelFontLarge'
import type { BadgeAnchor } from '../editions/apply'
import type { Template, TemplateVariant } from './types'

const BW = 96
const BH = 132
const SHADOW_OFFSET = 3
const CLASSIC_PHOTO = { x: 18, y: 16, w: 60, h: 64 }
const FULL_PHOTO = { x: 4, y: 4, w: 88, h: 124 }
const THEME = { x: 10, y: 8, w: 76, h: 80 }
const BANNER = { x: 6, y: 100, w: 76, h: 24 }
const BADGE_TR: BadgeAnchor = { x: BW - 1, y: 0, align: 'right' }

export const JOKER_EFFECTS = [
  'DOUBLES ALL SNACKS', '+10 DANCE MOVES', 'RETRIGGERS LAUGHTER', '+4 TO VIBES', 'X2 CHAOS ON FRIDAYS',
  'ALL SMILES SCORE TWICE', 'COPIES THE BEST POSE', '+1 HIGH FIVE PER ROUND', 'TURNS FROWNS UPSIDE DOWN',
]
export const randomJokerEffect = (rand: () => number = Math.random) => JOKER_EFFECTS[Math.floor(rand() * JOKER_EFFECTS.length)]

export const JOKER_LAYOUTS = [
  { value: 'sunburst', label: 'Sunburst' },
  { value: 'stripes', label: 'Stripes' },
  { value: 'stars', label: 'Starfield' },
  { value: 'halftone', label: 'Halftone' },
  { value: 'fullart', label: 'Full art' },
] as const
type Layout = (typeof JOKER_LAYOUTS)[number]['value']
type Classic = Exclude<Layout, 'fullart'>
const CLASSIC: readonly Classic[] = ['sunburst', 'stripes', 'stars', 'halftone']

export function rollJokerLayout(rand: () => number = Math.random): Layout {
  const r = rand()
  if (r < 0.25) return 'fullart'
  return CLASSIC[Math.min(CLASSIC.length - 1, Math.floor(((r - 0.25) / 0.75) * CLASSIC.length))]
}

const layoutOf = (v?: string): Layout => (JOKER_LAYOUTS.some((l) => l.value === v) ? (v as Layout) : 'sunburst')

/** Playing-card corner index: top-left reads down; bottom-right is the same turned 180°. */
function indices(ctx: CanvasRenderingContext2D, tl: { x: number; y: number }, br: { x: number; y: number }) {
  drawTextVertical(ctx, 'JOKER', tl.x, tl.y, RED, 'small', undefined, 'down')
  drawTextVertical(ctx, 'JOKER', br.x, br.y, RED, 'small', undefined, 'up')
}

function theme(ctx: CanvasRenderingContext2D, layout: Classic) {
  const r = THEME
  outline(ctx, OUTLINE, r.x - 1, r.y - 1, r.w + 2, r.h + 2)
  if (layout === 'sunburst') {
    fill(ctx, GOLD, r.x, r.y, r.w, r.h)
    ctx.fillStyle = css(RED)
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const sector = Math.floor(((Math.atan2(y + 0.5 - cy, x + 0.5 - cx) + Math.PI) / (2 * Math.PI)) * 16)
        if (sector % 2 === 0) ctx.fillRect(x, y, 1, 1)
      }
  } else if (layout === 'stripes') {
    fill(ctx, CREAM, r.x, r.y, r.w, r.h)
    ctx.fillStyle = css(BLUE)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) if (Math.floor((x + y) / 4) % 2 === 0) ctx.fillRect(x, y, 1, 1)
  } else if (layout === 'stars') {
    fill(ctx, NAVY, r.x, r.y, r.w, r.h)
    dither(ctx, r, CREAM, 0.03, 21)
    dither(ctx, r, GOLD, 0.012, 22)
  } else {
    fill(ctx, PURPLE, r.x, r.y, r.w, r.h)
    ctx.fillStyle = css(PINK)
    for (let y = r.y + 1; y < r.y + r.h; y += 4)
      for (let x = r.x + 1; x < r.x + r.w; x += 4) {
        const s = 1 + Math.floor(((y - r.y) / r.h) * 3)
        ctx.fillRect(x, y, Math.min(s, r.x + r.w - x), Math.min(s, r.y + r.h - y))
      }
  }
}

function classicBody(ctx: CanvasRenderingContext2D, values: Record<string, string>, layout: Classic) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, CARD_WHITE, 1, 1, BW - 2, BH - 2, 2)
  outline(ctx, CREAM_DARK, 2, 2, BW - 4, BH - 4)
  theme(ctx, layout)
  const P = CLASSIC_PHOTO
  panel(ctx, CREAM, P.x - 3, P.y - 3, P.w + 6, P.h + 6, 1)
  outline(ctx, OUTLINE, P.x - 1, P.y - 1, P.w + 2, P.h + 2)
  indices(ctx, { x: 8, y: 5 }, { x: 88, y: BH - 5 })

  panel(ctx, OUTLINE, 10, 91, BW - 20, 14, 2)
  panel(ctx, GOLD, 11, 92, BW - 22, 12, 1)
  drawTitle(ctx, values.name ?? '', BW / 2, 91, 70, OUTLINE, undefined, 1)
  wrapText(values.effect ?? '', 72, 2).forEach((line, i) => drawTextCentered(ctx, line, BW / 2, 109 + i * 8, OUTLINE))
}

function fullBody(ctx: CanvasRenderingContext2D) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, CARD_WHITE, 1, 1, BW - 2, BH - 2, 2)
  outline(ctx, OUTLINE, FULL_PHOTO.x - 1, FULL_PHOTO.y - 1, FULL_PHOTO.w + 2, FULL_PHOTO.h + 2)
}

function fullOverlay(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, OUTLINE, 2, 2, 10, 25, 2)
  panel(ctx, CARD_WHITE, 3, 3, 8, 23, 1)
  panel(ctx, OUTLINE, BW - 12, BH - 27, 10, 25, 2)
  panel(ctx, CARD_WHITE, BW - 11, BH - 26, 8, 23, 1)
  indices(ctx, { x: 10, y: 5 }, { x: BW - 10, y: BH - 5 })

  const B = BANNER
  panel(ctx, OUTLINE, B.x, B.y, B.w, B.h, 2)
  panel(ctx, CARD_WHITE, B.x + 1, B.y + 1, B.w - 2, B.h - 2, 1)
  const cx = B.x + B.w / 2
  drawTitle(ctx, values.name ?? '', cx, B.y + 1, B.w - 6, OUTLINE, undefined, 1)
  drawTextCentered(ctx, titleFit(values.effect ?? '', B.w - 6, 0).text, cx, B.y + 15, RED_DARK)
}

const shadowed = (draw: (c: CanvasRenderingContext2D) => void) => (ctx: CanvasRenderingContext2D) =>
  withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, draw)

const VARIANTS: Record<Layout, TemplateVariant> = {
  sunburst: { photoRect: CLASSIC_PHOTO, badgeAt: BADGE_TR, render: (ctx, v) => shadowed((c) => classicBody(c, v, 'sunburst'))(ctx) },
  stripes: { photoRect: CLASSIC_PHOTO, badgeAt: BADGE_TR, render: (ctx, v) => shadowed((c) => classicBody(c, v, 'stripes'))(ctx) },
  stars: { photoRect: CLASSIC_PHOTO, badgeAt: BADGE_TR, render: (ctx, v) => shadowed((c) => classicBody(c, v, 'stars'))(ctx) },
  halftone: { photoRect: CLASSIC_PHOTO, badgeAt: BADGE_TR, render: (ctx, v) => shadowed((c) => classicBody(c, v, 'halftone'))(ctx) },
  fullart: { photoRect: FULL_PHOTO, badgeAt: BADGE_TR, render: (ctx) => shadowed(fullBody)(ctx), overlay: fullOverlay },
}

export const jester: Template = {
  id: 'jester',
  name: 'Joker Card',
  description: 'Playing-card joker · a random silly effect',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: CLASSIC_PHOTO,
  badgeAt: BADGE_TR,
  printSizeMm: { w: 63, h: Math.round(((63 * (BH + SHADOW_OFFSET)) / (BW + SHADOW_OFFSET)) * 10) / 10 },
  fields: [
    { key: 'name', label: 'Name', default: 'JOKER', maxLength: 12 },
    { key: 'effect', label: 'Effect', default: () => randomJokerEffect(), maxLength: 36, perCapture: true },
    { key: 'layout', label: 'Layout', default: () => rollJokerLayout(), maxLength: 8, perCapture: true, options: JOKER_LAYOUTS },
  ],
  variant: (values) => VARIANTS[layoutOf(values.layout)],
  render(ctx, values) {
    VARIANTS[layoutOf(values.layout)].render!(ctx, values)
  },
}
```

Note: `titleFit(text, w, 0)` with `maxScale 0` skips the big font (small font, truncated) — check the loop handles 0 (it does: `s >= 1` never true).

`catalog.ts`: pack `jester` name `Joker Pack`, description `3 jokers with 3 different tricks. Keep 1.`; replace the `JESTER_CAP` import with a local copy (Task 5 replaces emblems anyway).

- [ ] **Step 4: Run** — Expected: PASS (fix any other test that referenced `JESTER_EFFECTS`/`Jester Pack`/old Jester name; ledger).
- [ ] **Step 5: Commit** `feat: the Joker card with sunburst, stripes, starfield, halftone and full-art layouts`

---

### Task 4: Teal planet

**Files:** `src/templates/planet.ts`; Test: `src/templates/planet.test.ts` (new)

- [ ] **Step 1: Failing tests** — `src/templates/planet.test.ts`:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { CARD_WHITE, CREAM, SHADOW, TEAL, TEAL_DARK, TEAL_INK, TEAL_LIGHT } from './colors'
import { css } from './draw'
import { getTemplate } from './registry'

afterEach(() => vi.restoreAllMocks())

test('teal palette only', () => {
  const sets: string[] = []
  const desc = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'fillStyle')!
  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillStyle', 'set').mockImplementation(function (this: CanvasRenderingContext2D, v: string | CanvasGradient | CanvasPattern) {
    sets.push(String(v))
    desc.set!.call(this, v)
  })
  getTemplate('planet').render(document.createElement('canvas').getContext('2d')!, { planet: 'SATURN', effect: 'LVL 7 SHINE' })
  expect(sets.length).toBeGreaterThan(0)
  const allowed = new Set([TEAL, TEAL_LIGHT, TEAL_DARK, TEAL_INK, CARD_WHITE, CREAM, SHADOW].map(css))
  expect(sets.filter((s) => !allowed.has(s))).toEqual([])
})

test('round photo window moved under the name pill; print size unchanged', () => {
  const t = getTemplate('planet')
  expect(t.photoRect).toEqual({ x: 22, y: 34, w: 52, h: 52 })
  expect(t.photoShape).toBe('circle')
  expect(t.printSizeMm.w).toBe(63)
})

test('long names and stats fit their slots; no holes', async () => {
  const font = await import('./pixelFontLarge')
  const spy = vi.spyOn(font, 'drawTitle')
  const cr = vi.spyOn(CanvasRenderingContext2D.prototype, 'clearRect')
  getTemplate('planet').render(document.createElement('canvas').getContext('2d')!, { planet: 'W'.repeat(10), effect: 'W'.repeat(16) })
  const i = spy.mock.calls.findIndex((c) => c[1] === 'W'.repeat(10))
  const { width } = spy.mock.results[i].value as { width: number }
  expect(width).toBeLessThanOrEqual(64)
  expect(cr.mock.calls.filter(([, , w, h]) => w * h < 96 * 132)).toEqual([])
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** — `planet.ts` body (fields unchanged; `PHOTO = { x: 22, y: 34, w: 52, h: 52 }`):

```ts
function body(ctx: CanvasRenderingContext2D, values: Record<string, string>) {
  panel(ctx, TEAL_INK, 0, 0, BW, BH, 4)
  panel(ctx, TEAL, 1, 1, BW - 2, BH - 2, 3)
  bevel(ctx, { x: 2, y: 2, w: BW - 4, h: BH - 4 }, TEAL_LIGHT, TEAL_DARK)
  dither(ctx, { x: 4, y: 4, w: BW - 8, h: BH - 8 }, TEAL_LIGHT, 0.02, 3)
  dither(ctx, { x: 4, y: 4, w: BW - 8, h: BH - 8 }, CREAM, 0.008, 4)

  // Instrument header: our own row of lights, a toggle and a level bar.
  panel(ctx, TEAL_INK, 6, 4, BW - 12, 10, 2)
  fill(ctx, TEAL_DARK, 7, 5, BW - 14, 8)
  fill(ctx, TEAL_LIGHT, 10, 8, 2, 2)
  fill(ctx, CREAM, 14, 8, 2, 2)
  panel(ctx, TEAL_LIGHT, 19, 6, 11, 5, 2)
  fill(ctx, CREAM, 25, 7, 3, 3)
  for (let i = 0; i < 5; i++) fill(ctx, i < 3 ? CREAM : TEAL_LIGHT, 35 + i * 4, 8, 2, 2)
  for (let x = 58; x < 78; x += 3) fill(ctx, TEAL_LIGHT, x, 7, 2, 4)
  ring(ctx, 84, 8, 2, CREAM)

  // Name pill.
  panel(ctx, TEAL_INK, 14, 17, 68, 13, 4)
  panel(ctx, CARD_WHITE, 15, 18, 66, 11, 3)
  drawTitle(ctx, values.planet ?? '', BW / 2, 16, 64, TEAL_INK, undefined, 1)

  // Orbit ring behind the round window.
  const cx = PHOTO.x + PHOTO.w / 2
  const cy = PHOTO.y + PHOTO.h / 2
  ctx.fillStyle = css(TEAL_LIGHT)
  for (let a = 0; a < 360; a++) {
    const t = (a * Math.PI) / 180
    ctx.fillRect(Math.round(cx + 40 * Math.cos(t)), Math.round(cy + 12 * Math.sin(t)), 1, 1)
  }
  fillShape(ctx, TEAL_LIGHT, grow(PHOTO, 3), 'circle')
  fillShape(ctx, TEAL_INK, grow(PHOTO, 1), 'circle')

  // Footer: cosmic stat, level pips, grille.
  panel(ctx, TEAL_INK, 8, 94, BW - 16, 32, 2)
  panel(ctx, TEAL_DARK, 9, 95, BW - 18, 30, 1)
  const stat = values.effect ?? ''
  drawTextCentered(ctx, stat, BW / 2, 98, CREAM)
  const digit = /\d/.exec(stat)
  const level = Math.min(5, Math.max(1, digit ? Number(digit[0]) : 3))
  for (let i = 0; i < 5; i++) {
    panel(ctx, TEAL_INK, 28 + i * 8, 106, 7, 7, 1)
    fill(ctx, i < level ? CREAM : TEAL_DARK, 29 + i * 8, 107, 5, 5)
  }
  for (let y = 117; y <= 121; y += 2) fill(ctx, TEAL_INK, 14, y, BW - 28, 1)
}
```

Imports: teal colours, `CARD_WHITE`, `CREAM`, `SHADOW`; `bevel, dither, ring` from `./detail`; `css, fill, panel, withDropShadow` from `./draw`; `drawTextCentered` from `./pixelFont`; `drawTitle` from `./pixelFontLarge`; `fillShape, grow`. Remove the old hash/starfield and `PIXEL COSMOS`.

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: redraw the planet card in teal with an instrument header, name pill and level pips`

---

### Task 5: Illustrated packs

**Files:** `src/packs/catalog.ts`, `src/packs/packArt.ts`; Test: `src/packs/art.test.ts`, `src/packs/catalog.test.ts`

- [ ] **Step 1: Failing tests** — append to `src/packs/art.test.ts`:

```ts
test.each(PACKS.map((p) => [p.id, p] as const))('%s pack illustration draws inside its area under the label', (_id, pack) => {
  const fr = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect')
  pack.art.illustration(document.createElement('canvas').getContext('2d')!, 32, 52)
  expect(fr.mock.calls.length).toBeGreaterThan(10)
  for (const [x, y, w, h] of fr.mock.calls) {
    expect(x).toBeGreaterThanOrEqual(32 - 16)
    expect(x + w).toBeLessThanOrEqual(32 + 16)
    expect(y).toBeGreaterThanOrEqual(52)
    expect(y + h).toBeLessThanOrEqual(52 + 19)
  }
  fr.mockRestore()
})
```

and in `catalog.test.ts` add `expect(PACKS.map((p) => p.name)).toEqual(['Classic Pack', 'Arcana Pack', 'Cosmic Pack', 'Joker Pack'])`.

- [ ] **Step 2: Run** — Expected: FAIL (no `illustration`).

- [ ] **Step 3: Implement**

`PackArt` becomes `{ body: Color; stripe: Color; ends: Color; shine: Color; illustration(ctx, cx, top): void }` (area: 32 × 19 centred on `cx`, starting at `top`).

Illustrations (in `catalog.ts`):

```ts
const card = (ctx: CanvasRenderingContext2D, x: number, y: number, pip: Color) => {
  panel(ctx, OUTLINE, x, y, 11, 15, 1)
  fill(ctx, CREAM, x + 1, y + 1, 9, 13)
  drawBitmap(ctx, ['010', '111', '010'], x + 4, y + 6, pip)
}
const fanned = (ctx: CanvasRenderingContext2D, cx: number, top: number) => {
  card(ctx, cx - 15, top + 3, RED)
  card(ctx, cx + 4, top + 3, OUTLINE)
  card(ctx, cx - 6, top, GOLD_DARK)
}
const sun = (ctx: CanvasRenderingContext2D, cx: number, top: number) => {
  const cy = top + 9
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4
    for (let r = 7; r <= 9; r++) fill(ctx, SEPIA_LIGHT, Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), 1, 1)
  }
  fillShape(ctx, SEPIA_INK, { x: cx - 6, y: cy - 6, w: 12, h: 12 }, 'circle')
  fillShape(ctx, GOLD, { x: cx - 5, y: cy - 5, w: 10, h: 10 }, 'circle')
  fill(ctx, SEPIA_DARK, cx - 2, cy - 1, 1, 1)
  fill(ctx, SEPIA_DARK, cx + 1, cy - 1, 1, 1)
  fill(ctx, SEPIA_DARK, cx - 1, cy + 2, 3, 1)
}
const ringed = (ctx: CanvasRenderingContext2D, cx: number, top: number) => {
  const cy = top + 9
  fillShape(ctx, TEAL_INK, { x: cx - 8, y: cy - 8, w: 16, h: 16 }, 'circle')
  fillShape(ctx, TEAL_LIGHT, { x: cx - 7, y: cy - 7, w: 14, h: 14 }, 'circle')
  fill(ctx, TEAL, cx - 7, cy - 1, 14, 3)
  for (let a = 0; a < 360; a += 4) {
    const t = (a * Math.PI) / 180
    const x = Math.round(cx + 14 * Math.cos(t))
    const y = Math.round(cy + 3 * Math.sin(t))
    if (Math.sin(t) > 0 || Math.abs(x - cx) > 7) fill(ctx, CREAM, x, y, 1, 1)
  }
}
const hat = (ctx: CanvasRenderingContext2D, cx: number, top: number) => {
  drawBitmap(ctx, JOKER_CAP, cx - 11, top + 4, RED, 2)
  for (const x of [cx - 13, cx + 10, cx - 2]) fill(ctx, GOLD, x, top + (x === cx - 2 ? 2 : 2), 3, 3)
}
```

(`JOKER_CAP` = the old `JESTER_CAP` bitmap, moved into `catalog.ts`; at scale 2 it is 22 × 12. Verify every illustration stays within ±16 px of `cx` and 19 rows — the test enforces it; adjust coordinates if a bound fails and ledger.)

Packs: Classic `{ body: PURPLE, stripe: PURPLE_DARK, ends: GOLD_DARK, shine: PURPLE_LIGHT, illustration: fanned }`; Arcana `{ body: SEPIA_DARK, stripe: SEPIA_INK, ends: SEPIA_MID, shine: SEPIA_MID, illustration: sun }`; Cosmic `{ body: TEAL_DARK, stripe: TEAL_INK, ends: TEAL_LIGHT, shine: TEAL, illustration: ringed }`; Joker `{ body: RED, stripe: RED_DARK, ends: GOLD, shine: RED_LIGHT, illustration: hat }`.

`packArt.ts` `wrapper`:
- After the stripe loop: foil crinkle `dither(ctx, { x: 1, y: 9, w: W - 2, h: H - 18 }, shine, 0.05, 9)`.
- In the crimp loop add a highlight on each tooth: `fill(ctx, shine, x + 1, 1, 1, 1)` and `fill(ctx, shine, x + 1, H - 2, 1, 1)`.
- Label: keep the plate; first word small at y 25; `drawBigCentered(ctx, 'PACK', W / 2, 32, OUTLINE, 2)`.
- Replace the emblem with `pack.art.illustration(ctx, W / 2, 52)`; move `PICK 1 OF 3` to y 73.

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: illustrated pack wrappers with foil crinkle; Arcana sepia, Cosmic teal`

---

### Task 6: Renders and approval

- [ ] `main` worktree on 5198, branch on 5199: render Joker in each layout (common + holo), Planet (common + holo), and the four packs (`packArt` at scale 4) before/after; inspect; fix visual issues (ledger rulings); publish a comparison page; get the user's approval.
- [ ] In the app: capture a Joker, switch the Layout select through all five, download the full-art one (badge visible on top of the photo).
- [ ] Remove the worktree, stop servers.
