# Shop Homepage & Booster Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the picker with a card-shop homepage (felt tray, tags, info boxes, odds panel, booster pack) and add the booster-pack flow: one photo → three distinct dealt cards with their own editions → pick one → editor.

**Architecture:** A new `src/packs` module holds the pure deal logic, pack-capture sizing, the pack viewfinder template and the pack wrapper art. The booth store gains `mode`, per-template remembered values (`saved`), `pack` and `revealed`. Booth switches to the viewfinder in pack mode; a new `PackDeal` screen (driven by a `useDeal` hook) flips the three cards and hands the pick to the editor, which skips its own reveal. The homepage becomes `Shop` with `OddsPanel`, tiles and info boxes; odds math moves to a shared `editionPercents`.

**Tech Stack:** Existing — Vite 8, React 19.2, TypeScript 6, Zustand 5, Vitest 4 + jsdom + vitest-canvas-mock, @testing-library/react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-14-shop-and-packs-design.md`

## Global Constraints

- Pack size 3; dealt template ids are distinct; never repeat when fewer templates exist.
- Pack capture: longest side ≤ 1600 px, aspect preserved, never upscaled, camera mirror baked in.
- Deal timing: slide-in stagger 120 ms; first flip after 400 ms, then 350 ms apart; choose animation 300 ms.
- Dealt cards render editions at `SNAPSHOT_ANGLE` (no live shimmer on the deal screen).
- After a pack pick the editor starts at `shown` (no reveal).
- Remembered values are per template id and are used by direct picks and pack deals; per-capture fields refresh on every capture/deal.
- Homepage single-column below 720 px; no horizontal scroll at 375 px.
- All motion disabled under `prefers-reduced-motion: reduce`.
- No currency/prices/rerolls. No new dependencies. Conventional Commits; no AI attribution. Branch `feat/shop-and-packs`.

## Review Focus

1. **Operator customizations reach pack cards** — text typed for a card type (e.g. ticket event) must appear when that type is dealt; serial/stats still fresh. Pinned in Task 3.
2. **Mashing taps on the deal screen** — taps while dealing reveal all; a second pick after choosing is ignored; leaving mid-deal leaves no timers. Pinned in Task 6.
3. **Uncropped pack photo vs portrait/landscape cards** — each card cover-crops without stretching; no upscaling of small uploads. Pinned in Task 2 (sizing) + manual check in Task 8.
4. **Keyboard-only shop** — every tile is a button with its info box wired via `aria-describedby`; the pack is reachable and starts pack mode. Pinned in Task 7.
5. **Odds math shared and consistent** — homepage odds and operator panel show the same percentages, including all-zero → 100% Common. Pinned in Task 7.

---

## File Structure

```
src/
  packs/
    deal.ts / deal.test.ts            PackCard, PACK_SIZE, pickDistinct, dealPack
    capture.ts / capture.test.ts      packCaptureSize, capturePackPhoto
    viewfinder.ts                     packViewfinder (Template, not registered)
    packArt.ts                        packArt(scale, target?) wrapper drawing
    art.test.ts                       viewfinder + pack art tests
  editions/odds.ts / odds.test.ts     editionPercents
  templates/types.ts (+ description)  and each template file (+ description)
  store/booth.ts / booth.test.ts      mode, saved, pack, revealed, selectPack, pickPackCard
  screens/
    StampCanvas.tsx                   (+ optional edition, optional label)
    Booth.tsx / Booth.test.tsx        pack mode viewfinder + pack capture
    useDeal.ts / useDeal.test.ts      deal reveal timing
    PackDeal.tsx / PackDeal.test.tsx  deal screen
    Editor.tsx / Editor.test.tsx      skip reveal when revealed
    Shop.tsx / Shop.test.tsx          homepage (replaces TemplatePicker.tsx)
    OperatorPanel.tsx                 use editionPercents
  App.tsx                             Shop + PackDeal screens
  index.css                           shop, tray, tiles, info, odds, deal styles
```

---

### Task 1: Template descriptions and the deal

**Files:**
- Modify: `src/templates/types.ts`, `src/templates/stamp.ts`, `src/templates/voucher.ts`, `src/templates/ticket.ts`, `src/templates/trading.ts`, `src/templates/idcard.ts`, `src/templates/templates.test.ts`
- Create: `src/packs/deal.ts`, `src/packs/deal.test.ts`

**Interfaces:**
- Produces:
  - `Template.description: string` (required)
  - `interface PackCard { templateId: string; edition: string; values: Record<string, string> }`
  - `PACK_SIZE = 3`
  - `pickDistinct<T>(items: readonly T[], n: number, rand: () => number): T[]`
  - `dealPack(settings: EditionSettings, saved: Record<string, Record<string, string>>, rand?: () => number): PackCard[]`

- [ ] **Step 1: Write failing tests.** Append to `src/templates/templates.test.ts` inside the existing `describe.each(...)('template %s', ...)` block (add as a new test there):

```ts
  test('has a one-line description for the shop', () => {
    expect(t.description.trim().length).toBeGreaterThan(0)
    expect(t.description).not.toMatch(/\n/)
  })
```

Create `src/packs/deal.test.ts`:

```ts
import { expect, test } from 'vitest'
import { getTemplate, templates } from '../templates/registry'
import { PACK_SIZE, dealPack, pickDistinct } from './deal'

/** Small seeded PRNG (mulberry32) for deterministic deals. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const settings = (forced = 'random') => ({ weights: { common: 60, foil: 25, holo: 12, poly: 3 }, forced })

test('deals PACK_SIZE distinct card types', () => {
  for (let s = 1; s < 50; s++) {
    const ids = dealPack(settings(), {}, seeded(s)).map((c) => c.templateId)
    expect(ids).toHaveLength(PACK_SIZE)
    expect(new Set(ids).size).toBe(PACK_SIZE)
  }
})

test('is deterministic for the same random source', () => {
  expect(dealPack(settings(), {}, seeded(7))).toEqual(dealPack(settings(), {}, seeded(7)))
})

test('each card rolls its edition from operator settings', () => {
  for (const card of dealPack(settings('holo'), {}, seeded(3))) expect(card.edition).toBe('holo')
})

test('uses remembered values for a card type and refreshes per-capture fields', () => {
  const ticket = getTemplate('ticket')
  const saved = { ticket: { event: 'GRAD NIGHT', date: '2026-01-01', serial: 'NO. 111111' } }
  // rand() = 0 deals voucher, ticket, trading (Fisher–Yates with j = 0 every step).
  const card = dealPack(settings(), saved, () => 0).find((c) => c.templateId === 'ticket')!
  expect(card.values.event).toBe('GRAD NIGHT')
  expect(card.values.date).toBe('2026-01-01')
  expect(card.values.serial).toMatch(/^NO\. \d{6}$/)
  expect(Object.keys(card.values).sort()).toEqual(ticket.fields.map((f) => f.key).sort())
})

test('cards without remembered values use their defaults', () => {
  const card = dealPack(settings(), {}, () => 0).find((c) => c.templateId === 'voucher')!
  expect(card.values.title).toBe('VOUCHER')
})

test('pickDistinct never repeats and caps at the number of items', () => {
  expect(pickDistinct(['a', 'b'], 3, Math.random).sort()).toEqual(['a', 'b'])
  expect(new Set(pickDistinct(templates, 3, seeded(9))).size).toBe(3)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/packs src/templates/templates.test.ts` → Expected: FAIL — `./deal` missing; description tests fail (`undefined.trim`).

- [ ] **Step 3: Add `description`.** In `src/templates/types.ts`, add to `Template` after `name: string`:

```ts
  /** One line for the shop's info box. */
  description: string
```

Add after each template's `name:` line:
- `stamp.ts`: `description: 'Postage stamp · perforated edge, title & value',`
- `voucher.ts`: `description: 'Coupon with a tear-off stub · title, amount & expiry',`
- `ticket.ts`: `description: 'Admit-one ticket · event, date & a fresh serial',`
- `trading.ts`: `description: 'Collectible card · rolls CHARM, CHAOS & LUCK',`
- `idcard.ts`: `description: 'Member card · club name, member no. & barcode',`

- [ ] **Step 4: Implement `src/packs/deal.ts`**

```ts
import { rollEdition, type EditionSettings } from '../editions/roll'
import { refreshPerCapture, resolveDefaults } from '../templates/fields'
import { templates } from '../templates/registry'

export interface PackCard {
  templateId: string
  edition: string
  values: Record<string, string>
}

export const PACK_SIZE = 3

/** Fisher–Yates shuffle, then take n (never more than there are items). */
export function pickDistinct<T>(items: readonly T[], n: number, rand: () => number): T[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(n, pool.length))
}

export function dealPack(
  settings: EditionSettings,
  saved: Record<string, Record<string, string>>,
  rand: () => number = Math.random,
): PackCard[] {
  return pickDistinct(templates, PACK_SIZE, rand).map((t) => ({
    templateId: t.id,
    edition: rollEdition(settings, rand),
    values: refreshPerCapture(t, saved[t.id] ?? resolveDefaults(t)),
  }))
}
```

- [ ] **Step 5: Run tests**

Run: `npm test` → Expected: all pass. `npx tsc -b` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/templates src/packs
git commit -m "feat: add template descriptions and booster pack deal"
```

---

### Task 2: Pack capture sizing

**Files:**
- Create: `src/packs/capture.ts`, `src/packs/capture.test.ts`

**Interfaces:**
- Consumes: `PhotoSource`, `cropPhoto`
- Produces: `PACK_CAPTURE_MAX = 1600`, `packCaptureSize(w: number, h: number, max?: number): { w: number; h: number }`, `capturePackPhoto(photo: PhotoSource): PhotoSource`

- [ ] **Step 1: Write failing tests** `src/packs/capture.test.ts`:

```ts
import { expect, test } from 'vitest'
import { capturePackPhoto, packCaptureSize } from './capture'

test('scales the longest side down to 1600 and keeps the aspect', () => {
  expect(packCaptureSize(1920, 1080)).toEqual({ w: 1600, h: 900 })
  expect(packCaptureSize(1080, 1920)).toEqual({ w: 900, h: 1600 })
})

test('never upscales small photos', () => {
  expect(packCaptureSize(640, 480)).toEqual({ w: 640, h: 480 })
})

test('rounds to whole pixels and never returns 0', () => {
  expect(packCaptureSize(4000, 1)).toEqual({ w: 1600, h: 1 })
})

test('capturePackPhoto bakes the mirror into an unmirrored canvas of that size', () => {
  const out = capturePackPhoto({ source: document.createElement('canvas'), w: 1920, h: 1080, mirror: true })
  expect([out.w, out.h, out.mirror]).toEqual([1600, 900, undefined])
  const c = out.source as HTMLCanvasElement
  expect([c.width, c.height]).toEqual([1600, 900])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/packs/capture.test.ts` → Expected: FAIL, missing `./capture`.

- [ ] **Step 3: Implement `src/packs/capture.ts`**

```ts
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
```

- [ ] **Step 4: Run tests** — `npx vitest run src/packs` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/packs/capture.ts src/packs/capture.test.ts
git commit -m "feat: add uncropped pack photo capture"
```

---

### Task 3: Booth store — modes, remembered values, pack

**Files:**
- Modify: `src/store/booth.ts`, `src/store/booth.test.ts`

**Interfaces:**
- Consumes: `dealPack`, `PackCard`, `rollEdition`, `useOperator`
- Produces: `Screen = 'picker' | 'booth' | 'pack' | 'editor'`, `Mode = 'single' | 'pack'`; state `mode`, `saved`, `pack: PackCard[] | null`, `revealed: boolean`; actions `selectPack()`, `pickPackCard(i: number)`; changed semantics of `selectTemplate`, `setCapture`, `retake`, `goToPicker`, `setValue` as in the spec

- [ ] **Step 1: Write failing tests** — append to `src/store/booth.test.ts` (add `vi` to the vitest import and `afterEach` if not imported):

```ts
describe('remembered values and packs', () => {
  beforeEach(() => {
    localStorage.clear()
    useOperator.getState().reset()
  })
  afterEach(() => vi.restoreAllMocks())

  test('edits are remembered per card type across switches', () => {
    s().selectTemplate('ticket')
    s().setValue('event', 'GRAD NIGHT')
    s().selectTemplate('stamp')
    expect(s().values.title).toBe('FIRST STAMP')
    s().selectTemplate('ticket')
    expect(s().values.event).toBe('GRAD NIGHT')
  })

  test('selectPack enters pack mode on the booth', () => {
    s().selectPack()
    expect([s().mode, s().screen, s().capture, s().pack]).toEqual(['pack', 'booth', null, null])
  })

  test('a pack capture deals three cards using remembered values and shows the pack screen', () => {
    s().selectTemplate('ticket')
    s().setValue('event', 'GRAD NIGHT')
    useOperator.getState().setForced('foil')
    s().selectPack()
    vi.spyOn(Math, 'random').mockReturnValue(0) // deals voucher, ticket, trading
    s().setCapture(photo())
    expect(s().screen).toBe('pack')
    expect(s().pack).toHaveLength(3)
    expect(s().pack!.every((c) => c.edition === 'foil')).toBe(true)
    expect(s().pack!.find((c) => c.templateId === 'ticket')!.values.event).toBe('GRAD NIGHT')
  })

  test('pickPackCard opens the editor with that card, already revealed, and remembers its text', () => {
    s().selectPack()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    s().setCapture(photo())
    const card = s().pack![1]
    s().pickPackCard(1)
    expect([s().screen, s().templateId, s().edition, s().revealed]).toEqual(['editor', card.templateId, card.edition, true])
    expect(s().values).toEqual(card.values)
    expect(s().saved[card.templateId]).toEqual(card.values)
  })

  test('pickPackCard ignores bad indexes and missing packs', () => {
    s().pickPackCard(0)
    expect(s().screen).toBe('picker')
    s().selectPack()
    s().setCapture(photo())
    s().pickPackCard(7)
    expect(s().screen).toBe('pack')
  })

  test('retake keeps pack mode and clears the deal', () => {
    s().selectPack()
    s().setCapture(photo())
    s().pickPackCard(0)
    s().retake()
    expect([s().mode, s().screen, s().pack, s().revealed, s().capture]).toEqual(['pack', 'booth', null, false, null])
  })

  test('selecting a single card leaves pack mode and resets revealed', () => {
    s().selectPack()
    s().setCapture(photo())
    s().pickPackCard(0)
    s().selectTemplate('stamp')
    expect([s().mode, s().revealed]).toEqual(['single', false])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/booth.test.ts` → Expected: FAIL (`selectPack` is not a function, etc.).

- [ ] **Step 3: Replace `src/store/booth.ts`**

```ts
import { create } from 'zustand'
import { rollEdition } from '../editions/roll'
import { dealPack, type PackCard } from '../packs/deal'
import type { PhotoSource } from '../photo/crop'
import { clampValue, refreshPerCapture, resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'
import { useOperator } from './operator'

export type Screen = 'picker' | 'booth' | 'pack' | 'editor'
export type Mode = 'single' | 'pack'

interface BoothState {
  screen: Screen
  mode: Mode
  templateId: string
  capture: PhotoSource | null
  /** Edition id rolled for the current capture. */
  edition: string
  values: Record<string, string>
  /** Text remembered per card type, used by direct picks and pack deals. */
  saved: Record<string, Record<string, string>>
  pack: PackCard[] | null
  /** The card was already revealed (pack pick), so the editor skips its flip. */
  revealed: boolean
  selectTemplate(id: string): void
  selectPack(): void
  setCapture(photo: PhotoSource): void
  pickPackCard(index: number): void
  retake(): void
  goToPicker(): void
  setValue(key: string, value: string): void
}

const cleared = { capture: null, edition: 'common', pack: null, revealed: false } as const

export const useBooth = create<BoothState>()((set, get) => ({
  screen: 'picker',
  mode: 'single',
  templateId: 'stamp',
  capture: null,
  edition: 'common',
  values: resolveDefaults(getTemplate('stamp')),
  saved: {},
  pack: null,
  revealed: false,

  selectTemplate(id) {
    set({
      ...cleared,
      mode: 'single',
      templateId: id,
      values: get().saved[id] ?? resolveDefaults(getTemplate(id)),
      screen: 'booth',
    })
  },
  selectPack: () => set({ ...cleared, mode: 'pack', screen: 'booth' }),
  setCapture(photo) {
    if (get().mode === 'pack') {
      set({ capture: photo, pack: dealPack(useOperator.getState(), get().saved), screen: 'pack' })
      return
    }
    const t = getTemplate(get().templateId)
    set({
      capture: photo,
      edition: rollEdition(useOperator.getState()),
      values: refreshPerCapture(t, get().values),
      screen: 'editor',
    })
  },
  pickPackCard(index) {
    const card = get().pack?.[index]
    if (!card) return
    set({
      templateId: card.templateId,
      values: card.values,
      edition: card.edition,
      saved: { ...get().saved, [card.templateId]: card.values },
      revealed: true,
      screen: 'editor',
    })
  },
  retake: () => set({ ...cleared, screen: 'booth' }),
  goToPicker: () => set({ ...cleared, screen: 'picker' }),
  setValue(key, value) {
    const { templateId, values, saved } = get()
    const field = getTemplate(templateId).fields.find((f) => f.key === key)
    if (!field) return
    const next = { ...values, [key]: clampValue(field, value) }
    set({ values: next, saved: { ...saved, [templateId]: next } })
  },
}))
```

- [ ] **Step 4: Run tests**

Run: `npm test` → Expected: all pass (existing store tests still hold: re-selecting the same template keeps edits via `saved`).

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat: remember text per card type and add pack mode to the booth store"
```

---

### Task 4: Pack viewfinder and pack art

**Files:**
- Create: `src/packs/viewfinder.ts`, `src/packs/packArt.ts`, `src/packs/art.test.ts`

**Interfaces:**
- Consumes: colors (`OUTLINE, SHADOW, CREAM, GOLD, GOLD_DARK, PURPLE, PURPLE_DARK`), draw helpers, font
- Produces: `packViewfinder: Template` (id `'pack-viewfinder'`, no fields, not registered), `PACK_ART_SIZE = { w: 67, h: 91 }`, `packArt(scale: number, target?: HTMLCanvasElement): HTMLCanvasElement`

- [ ] **Step 1: Write failing tests** `src/packs/art.test.ts`:

```ts
import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { PACK_ART_SIZE, packArt } from './packArt'
import { packViewfinder } from './viewfinder'

test('viewfinder has a 3:4 photo window inside the frame and is not selectable', () => {
  const r = packViewfinder.photoRect
  expect(r.w / r.h).toBeCloseTo(3 / 4)
  expect(r.x + r.w).toBeLessThanOrEqual(packViewfinder.size.w)
  expect(r.y + r.h).toBeLessThanOrEqual(packViewfinder.size.h)
  expect(templates.some((t) => t.id === packViewfinder.id)).toBe(false)
  expect(() => packViewfinder.render(document.createElement('canvas').getContext('2d')!, {})).not.toThrow()
})

test('pack art is its art size × scale and draws into a target', () => {
  const c = packArt(3)
  expect([c.width, c.height]).toEqual([PACK_ART_SIZE.w * 3, PACK_ART_SIZE.h * 3])
  const target = document.createElement('canvas')
  expect(packArt(2, target)).toBe(target)
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/packs/art.test.ts` → FAIL, missing modules.

- [ ] **Step 3: Implement `src/packs/viewfinder.ts`**

```ts
import { CREAM, GOLD, OUTLINE, PURPLE, PURPLE_DARK, SHADOW } from '../templates/colors'
import { fill, outline, panel, withDropShadow } from '../templates/draw'
import { drawTextCentered } from '../templates/pixelFont'
import type { Template } from '../templates/types'

const BW = 96
const BH = 132
const SHADOW_OFFSET = 3
const PHOTO = { x: 12, y: 10, w: 72, h: 96 }

function body(ctx: CanvasRenderingContext2D) {
  panel(ctx, OUTLINE, 0, 0, BW, BH, 3)
  panel(ctx, PURPLE, 1, 1, BW - 2, BH - 2, 2)
  for (let y = 3; y < BH - 3; y++) {
    for (let x = 3; x < BW - 3; x++) if ((x + y) % 10 === 0) fill(ctx, PURPLE_DARK, x, y, 1, 1)
  }
  panel(ctx, CREAM, PHOTO.x - 3, PHOTO.y - 3, PHOTO.w + 6, PHOTO.h + 6, 1)
  outline(ctx, OUTLINE, PHOTO.x - 1, PHOTO.y - 1, PHOTO.w + 2, PHOTO.h + 2)
  drawTextCentered(ctx, 'BOOSTER PACK', BW / 2, 112, CREAM, 1, PURPLE_DARK)
  drawTextCentered(ctx, 'SMILE!', BW / 2, 121, GOLD, 1, PURPLE_DARK)
}

/** Booth frame for pack mode. Not in the registry, so it can't be picked or dealt. */
export const packViewfinder: Template = {
  id: 'pack-viewfinder',
  name: 'Booster Pack',
  description: '',
  size: { w: BW + SHADOW_OFFSET, h: BH + SHADOW_OFFSET },
  photoRect: PHOTO,
  printSizeMm: { w: 50, h: 69 },
  fields: [],
  render(ctx) {
    withDropShadow(ctx, BW, BH, SHADOW_OFFSET, SHADOW, body)
  },
}
```

- [ ] **Step 4: Implement `src/packs/packArt.ts`**

```ts
import { CREAM, GOLD, GOLD_DARK, OUTLINE, PURPLE, PURPLE_DARK, SHADOW } from '../templates/colors'
import { drawBitmap, fill, panel, withDropShadow } from '../templates/draw'
import { drawTextCentered } from '../templates/pixelFont'

const W = 64
const H = 88
const SHADOW_OFFSET = 3
export const PACK_ART_SIZE = { w: W + SHADOW_OFFSET, h: H + SHADOW_OFFSET }

const STAR = ['0001000', '0001000', '0011100', '1111111', '0011100', '0110110', '1100011']

function wrapper(ctx: CanvasRenderingContext2D) {
  // Body between the crimped ends.
  fill(ctx, OUTLINE, 0, 4, W, H - 8)
  fill(ctx, PURPLE, 1, 9, W - 2, H - 18)
  for (let y = 9; y < H - 9; y++) {
    for (let x = 1; x < W - 1; x++) if ((x + y) % 12 < 2) fill(ctx, PURPLE_DARK, x, y, 1, 1)
  }
  // Crimped foil ends: a gold band with sawtooth edges.
  fill(ctx, GOLD_DARK, 1, 5, W - 2, 4)
  fill(ctx, GOLD_DARK, 1, H - 9, W - 2, 4)
  for (let x = 0; x < W; x += 4) {
    fill(ctx, OUTLINE, x, 0, 3, 5)
    fill(ctx, GOLD_DARK, x + 1, 1, 1, 4)
    fill(ctx, OUTLINE, x, H - 5, 3, 5)
    fill(ctx, GOLD_DARK, x + 1, H - 5, 1, 4)
  }
  // Label.
  panel(ctx, OUTLINE, 6, 20, W - 12, 30, 2)
  panel(ctx, GOLD, 7, 21, W - 14, 28, 1)
  drawTextCentered(ctx, 'BOOSTER', W / 2, 25, OUTLINE)
  drawTextCentered(ctx, 'PACK', W / 2, 33, OUTLINE, 2)
  drawBitmap(ctx, STAR, W / 2 - 3, 55, GOLD)
  drawTextCentered(ctx, 'PICK 1 OF 3', W / 2, 69, CREAM, 1, PURPLE_DARK)
}

export function packArt(scale: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const art = document.createElement('canvas')
  art.width = PACK_ART_SIZE.w
  art.height = PACK_ART_SIZE.h
  withDropShadow(art.getContext('2d')!, W, H, SHADOW_OFFSET, SHADOW, wrapper)
  const out = target ?? document.createElement('canvas')
  out.width = PACK_ART_SIZE.w * scale
  out.height = PACK_ART_SIZE.h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(art, 0, 0, out.width, out.height)
  return out
}
```

- [ ] **Step 5: Run tests** — `npm test` → all pass; `npx tsc -b` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/packs
git commit -m "feat: add booster pack viewfinder and wrapper art"
```

---

### Task 5: Booth in pack mode

**Files:**
- Modify: `src/screens/Booth.tsx`, `src/screens/Booth.test.tsx`

**Interfaces:**
- Consumes: `packViewfinder`, `capturePackPhoto`, store `mode`

- [ ] **Step 1: Write failing test** — append to `src/screens/Booth.test.tsx`:

```tsx
import { useBooth } from '../store/booth'

test('pack mode shows the booster pack viewfinder', () => {
  useBooth.setState({ ...useBooth.getInitialState(), mode: 'pack', screen: 'booth' }, true)
  render(<Booth />)
  expect(screen.getByRole('heading', { name: 'Booster Pack' })).toBeTruthy()
  expect(screen.getByRole('img', { name: /booster pack live preview/i })).toBeTruthy()
  useBooth.setState(useBooth.getInitialState(), true)
})
```

(Move the `useBooth` import to the top of the file with the other imports.)

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/screens/Booth.test.tsx` → FAIL (heading is "Stamp").

- [ ] **Step 3: Update `src/screens/Booth.tsx`**

Add imports:

```tsx
import { capturePackPhoto } from '../packs/capture'
import { packViewfinder } from '../packs/viewfinder'
```

Replace `const template = getTemplate(templateId)` with:

```tsx
  const mode = useBooth((s) => s.mode)
  const template = mode === 'pack' ? packViewfinder : getTemplate(templateId)
```

Replace the `keep` callback body:

```tsx
  const keep = useCallback(
    (photo: PhotoSource) => {
      if (mode === 'pack') return setCapture(capturePackPhoto(photo))
      const r = template.photoRect
      setCapture(cropPhoto(photo, r.w * EXPORT_SCALE, r.h * EXPORT_SCALE))
    },
    [mode, template, setCapture],
  )
```

- [ ] **Step 4: Run tests** — `npm test` → all pass; `npx tsc -b`, `npm run lint` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Booth.tsx src/screens/Booth.test.tsx
git commit -m "feat: use the pack viewfinder and uncropped capture in pack mode"
```

---

### Task 6: Deal screen

**Files:**
- Create: `src/screens/useDeal.ts`, `src/screens/useDeal.test.ts`, `src/screens/PackDeal.tsx`, `src/screens/PackDeal.test.tsx`
- Modify: `src/screens/StampCanvas.tsx`, `src/App.tsx`, `src/index.css`

**Interfaces:**
- Consumes: store `pack`, `capture`, `pickPackCard`; `getTemplate`, `getEdition`, `SNAPSHOT_ANGLE`, `CardBackCanvas`, `prefersReducedMotion`
- Produces:
  - `DEAL_TIMING = { first: 400, gap: 350, choose: 300 }`
  - `useDeal(count: number, reducedMotion: boolean): { revealed: number; revealAll(): void }` — window keydown reveals all while dealing
  - `StampCanvas` props gain optional `edition?: Edition`; `label` becomes optional (no label → `aria-hidden`)
  - `<PackDeal />`

- [ ] **Step 1: Write failing tests.** `src/screens/useDeal.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DEAL_TIMING, useDeal } from './useDeal'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('flips one card at a time', () => {
  const { result } = renderHook(() => useDeal(3, false))
  expect(result.current.revealed).toBe(0)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.first))
  expect(result.current.revealed).toBe(1)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.gap))
  expect(result.current.revealed).toBe(2)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.gap))
  expect(result.current.revealed).toBe(3)
  act(() => vi.advanceTimersByTime(DEAL_TIMING.gap * 3))
  expect(result.current.revealed).toBe(3)
})

test('reduced motion starts fully revealed', () => {
  const { result } = renderHook(() => useDeal(3, true))
  expect(result.current.revealed).toBe(3)
})

test('revealAll and any key reveal everything', () => {
  const a = renderHook(() => useDeal(3, false))
  act(() => a.result.current.revealAll())
  expect(a.result.current.revealed).toBe(3)
  const b = renderHook(() => useDeal(3, false))
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  })
  expect(b.result.current.revealed).toBe(3)
})

test('unmounting mid-deal leaves no timers', () => {
  const { unmount } = renderHook(() => useDeal(3, false))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
```

`src/screens/PackDeal.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useBooth } from '../store/booth'
import { DEAL_TIMING } from './useDeal'
import { PackDeal } from './PackDeal'

const pack = [
  { templateId: 'stamp', edition: 'common', values: { title: 'A', value: '1¢' } },
  { templateId: 'ticket', edition: 'holo', values: { event: 'B', date: '2026-01-01', serial: 'NO. 000001' } },
  { templateId: 'trading', edition: 'foil', values: { name: 'C', type: 'D', charm: '1', chaos: '2', luck: '3' } },
]

function setup(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: reduced && q.includes('reduce'), addEventListener() {}, removeEventListener() {} }),
  })
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      mode: 'pack',
      screen: 'pack',
      capture: { source: document.createElement('canvas'), w: 1600, h: 900 },
      pack,
    },
    true,
  )
  render(<PackDeal />)
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  useBooth.setState(useBooth.getInitialState(), true)
  Reflect.deleteProperty(window, 'matchMedia')
})

test('reduced motion: all three cards are face up and named by type and edition', () => {
  setup(true)
  expect(screen.getByRole('button', { name: 'Stamp, Common edition' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Ticket, Holographic edition' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Trading Card, Foil edition' })).toBeTruthy()
})

test('tapping while dealing reveals all instead of picking', () => {
  setup(false)
  const faceDown = screen.getAllByRole('button', { name: 'Face-down card' })
  fireEvent.click(faceDown[0])
  expect(useBooth.getState().screen).toBe('pack')
  expect(screen.getByRole('button', { name: 'Stamp, Common edition' })).toBeTruthy()
})

test('choosing a card opens the editor with it; a second tap is ignored', () => {
  setup(true)
  fireEvent.click(screen.getByRole('button', { name: 'Ticket, Holographic edition' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stamp, Common edition' }))
  act(() => vi.advanceTimersByTime(DEAL_TIMING.choose))
  const s = useBooth.getState()
  expect([s.screen, s.templateId, s.edition, s.revealed]).toEqual(['editor', 'ticket', 'holo', true])
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/screens/useDeal.test.ts src/screens/PackDeal.test.tsx` → FAIL, missing modules.

- [ ] **Step 3: Implement `src/screens/useDeal.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'

export const DEAL_TIMING = { first: 400, gap: 350, choose: 300 } as const

/** Number of dealt cards flipped face up; flips one at a time unless motion is reduced. */
export function useDeal(count: number, reducedMotion: boolean) {
  const [revealed, setRevealed] = useState(reducedMotion ? count : 0)
  const revealAll = useCallback(() => setRevealed(count), [count])

  useEffect(() => {
    if (revealed >= count) return
    const id = setTimeout(() => setRevealed((r) => r + 1), revealed === 0 ? DEAL_TIMING.first : DEAL_TIMING.gap)
    return () => clearTimeout(id)
  }, [revealed, count])

  useEffect(() => {
    if (revealed >= count) return
    window.addEventListener('keydown', revealAll)
    return () => window.removeEventListener('keydown', revealAll)
  }, [revealed, count, revealAll])

  return { revealed, revealAll }
}
```

- [ ] **Step 4: Update `src/screens/StampCanvas.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { SNAPSHOT_ANGLE } from '../editions/angle'
import type { Edition } from '../editions/types'
import type { PhotoSource } from '../photo/crop'
import { composeStamp } from '../render/composeStamp'
import type { Template } from '../templates/types'

interface Props {
  template: Template
  photo: PhotoSource
  values: Record<string, string>
  scale: number
  /** Omit when a surrounding control already names the card; the canvas is then hidden from assistive tech. */
  label?: string
  className?: string
  /** Static edition snapshot (no animation). */
  edition?: Edition
}

export function StampCanvas({ template, photo, values, scale, label, className = '', edition }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) composeStamp(template, photo, values, scale, ref.current, { edition, angle: SNAPSHOT_ANGLE })
  }, [template, photo, values, scale, edition])
  return label ? (
    <canvas ref={ref} className={`stamp-canvas ${className}`} role="img" aria-label={label} />
  ) : (
    <canvas ref={ref} className={`stamp-canvas ${className}`} aria-hidden="true" />
  )
}
```

- [ ] **Step 5: Implement `src/screens/PackDeal.tsx`**

```tsx
import { useEffect, useState, type CSSProperties } from 'react'
import { getEdition } from '../editions/registry'
import { useBooth } from '../store/booth'
import { getTemplate } from '../templates/registry'
import { prefersReducedMotion } from '../ui/motion'
import { CardBackCanvas } from './CardBackCanvas'
import { StampCanvas } from './StampCanvas'
import { DEAL_TIMING, useDeal } from './useDeal'

const DEAL_SCALE = 2

export function PackDeal() {
  const pack = useBooth((s) => s.pack)
  const capture = useBooth((s) => s.capture)
  const { pickPackCard, goToPicker } = useBooth.getState()
  const [reducedMotion] = useState(prefersReducedMotion)
  const count = pack?.length ?? 0
  const { revealed, revealAll } = useDeal(count, reducedMotion)
  const [chosen, setChosen] = useState<number | null>(null)

  // Let the chosen card lift before switching screens.
  useEffect(() => {
    if (chosen === null) return
    const id = setTimeout(() => pickPackCard(chosen), reducedMotion ? 0 : DEAL_TIMING.choose)
    return () => clearTimeout(id)
  }, [chosen, reducedMotion, pickPackCard])

  if (!pack || !capture) return null
  const dealing = revealed < count

  return (
    <section className="screen">
      <h2>Pick one to keep</h2>
      <div className="deal">
        {pack.map((card, i) => {
          const template = getTemplate(card.templateId)
          const edition = getEdition(card.edition)
          const faceUp = i < revealed
          const state = chosen === null ? '' : chosen === i ? 'chosen' : 'dismissed'
          return (
            <button
              key={card.templateId}
              className={`deal-card ${faceUp ? 'up' : ''} ${faceUp && edition.rare ? 'glint' : ''} ${state}`}
              style={{ '--i': i } as CSSProperties}
              aria-label={faceUp ? `${template.name}, ${edition.name} edition` : 'Face-down card'}
              onClick={() => {
                if (dealing) return revealAll()
                if (chosen === null) setChosen(i)
              }}
            >
              <div className="deal-inner">
                <div className="deal-face deal-front">
                  <StampCanvas template={template} photo={capture} values={card.values} scale={DEAL_SCALE} edition={edition} />
                </div>
                <div className="deal-face deal-back">
                  <CardBackCanvas template={template} scale={DEAL_SCALE} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
      <p className="deal-hint" aria-live="polite">{dealing ? 'Dealing…' : 'Tap a card to keep it'}</p>
      <button className="btn" onClick={goToPicker}>Back to shop</button>
    </section>
  )
}
```

- [ ] **Step 6: Wire into `src/App.tsx`** — add `import { PackDeal } from './screens/PackDeal'` and `{screen === 'pack' && <PackDeal />}` after the booth line.

- [ ] **Step 7: Styles** — add to `src/index.css` before `/* Operator panel */`:

```css
/* Pack deal */
.deal { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; align-items: center; max-width: 100%; }
.deal-card {
  background: none; border: 0; padding: 0; cursor: pointer; max-width: 100%; perspective: 1000px;
  animation: deal-in 400ms cubic-bezier(.2, 1.2, .4, 1) backwards;
  animation-delay: calc(var(--i) * 120ms);
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}
@keyframes deal-in { from { transform: translateY(-80px) rotate(-10deg); opacity: 0; } }
.deal-card:focus-visible { outline: 3px solid var(--gold); outline-offset: 4px; }
.deal-inner { position: relative; transform-style: preserve-3d; transform: rotateY(180deg); transition: transform 500ms cubic-bezier(.3, 1.4, .5, 1); }
.deal-card.up .deal-inner { transform: none; }
.deal-face { backface-visibility: hidden; }
.deal-front { position: relative; }
.deal-back { position: absolute; inset: 0; transform: rotateY(180deg); }
.deal-card canvas { display: block; width: auto; height: auto; max-width: 100%; max-height: 260px; }
.deal-card.glint .deal-front::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen;
  background: linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.75) 45%, transparent 60%);
  background-size: 250% 100%; animation: glint 900ms ease-out 450ms both;
}
@keyframes glint { from { background-position: 150% 0; } to { background-position: -50% 0; } }
.deal-card.chosen { transform: translateY(-16px) scale(1.06); }
.deal-card.dismissed { opacity: 0; transform: scale(.9); pointer-events: none; }
.deal-hint { margin: 0; font-weight: 700; text-shadow: 2px 2px 0 var(--dark); }
```

and inside the reduced-motion block add:

```css
  .deal-card { animation: none; transition: none; }
  .deal-inner { transition: none; }
  .deal-card.glint .deal-front::after { display: none; }
```

- [ ] **Step 8: Run tests** — `npm test` → all pass; `npx tsc -b`, `npm run lint` → clean.

- [ ] **Step 9: Commit**

```bash
git add src/screens src/App.tsx src/index.css
git commit -m "feat: add booster pack deal screen"
```

---

### Task 7: Editor skips reveal after a pack pick; shop homepage

**Files:**
- Create: `src/editions/odds.ts`, `src/editions/odds.test.ts`, `src/screens/Shop.tsx`, `src/screens/Shop.test.tsx`, `src/screens/Editor.test.tsx`
- Modify: `src/screens/Editor.tsx`, `src/screens/OperatorPanel.tsx`, `src/App.tsx`, `src/index.css`
- Delete: `src/screens/TemplatePicker.tsx`

**Interfaces:**
- Consumes: `templates`, `useOperator`, `useBooth` (`selectTemplate`, `selectPack`, `revealed`), `TiltCard`, `StampCanvas`, `placeholderPhoto`, `resolveDefaults`, `packArt`
- Produces: `editionPercents(weights: Record<string, number>): Record<string, number>`; `<Shop />`

- [ ] **Step 1: Write failing tests.** `src/editions/odds.test.ts`:

```ts
import { expect, test } from 'vitest'
import { editionPercents } from './odds'

test('percentages from weights', () => {
  expect(editionPercents({ common: 60, foil: 25, holo: 12, poly: 3 })).toEqual({ common: 60, foil: 25, holo: 12, poly: 3 })
  expect(editionPercents({ common: 1, foil: 1, holo: 0, poly: 0 })).toEqual({ common: 50, foil: 50, holo: 0, poly: 0 })
})

test('all-zero or garbage weights mean 100% common', () => {
  expect(editionPercents({ common: 0, foil: 0, holo: 0, poly: 0 })).toEqual({ common: 100, foil: 0, holo: 0, poly: 0 })
  expect(editionPercents({ common: -1, foil: Number.NaN })).toEqual({ common: 100, foil: 0, holo: 0, poly: 0 })
})
```

`src/screens/Shop.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { templates } from '../templates/registry'
import { Shop } from './Shop'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('every card is a button described by its info box', () => {
  render(<Shop />)
  for (const t of templates) {
    const button = screen.getByRole('button', { name: t.name })
    const infoId = button.getAttribute('aria-describedby')!
    expect(document.getElementById(infoId)?.textContent).toBe(t.description)
    expect(document.getElementById(infoId)?.getAttribute('role')).toBe('tooltip')
  }
})

test('choosing a card opens the booth for it', () => {
  render(<Shop />)
  fireEvent.click(screen.getByRole('button', { name: 'Ticket' }))
  expect([useBooth.getState().screen, useBooth.getState().templateId, useBooth.getState().mode]).toEqual(['booth', 'ticket', 'single'])
})

test('the booster pack starts pack mode and has its own info box', () => {
  render(<Shop />)
  const pack = screen.getByRole('button', { name: 'Booster Pack' })
  expect(document.getElementById(pack.getAttribute('aria-describedby')!)?.textContent).toMatch(/keep 1/i)
  fireEvent.click(pack)
  expect([useBooth.getState().screen, useBooth.getState().mode]).toEqual(['booth', 'pack'])
})

test('odds panel follows the operator settings', () => {
  useOperator.getState().setWeight('common', 0)
  useOperator.getState().setWeight('foil', 0)
  useOperator.getState().setWeight('holo', 1)
  useOperator.getState().setWeight('poly', 1)
  render(<Shop />)
  expect(screen.getByTestId('odds-holo').textContent).toBe('50%')
  expect(screen.getByTestId('odds-common').textContent).toBe('0%')
})
```

`src/screens/Editor.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { useBooth } from '../store/booth'
import { resolveDefaults } from '../templates/fields'
import { getTemplate } from '../templates/registry'
import { Editor } from './Editor'

afterEach(() => useBooth.setState(useBooth.getInitialState(), true))

function open(revealed: boolean) {
  useBooth.setState(
    {
      ...useBooth.getInitialState(),
      screen: 'editor',
      templateId: 'ticket',
      edition: 'holo',
      values: resolveDefaults(getTemplate('ticket')),
      capture: { source: document.createElement('canvas'), w: 480, h: 512 },
      revealed,
    },
    true,
  )
  return render(<Editor />)
}

test('a card picked from a pack starts revealed', () => {
  const { container } = open(true)
  expect(container.querySelector('.reveal')?.getAttribute('data-phase')).toBe('shown')
})

test('a direct capture still plays the flip', () => {
  const { container } = open(false)
  expect(container.querySelector('.reveal')?.getAttribute('data-phase')).toBe('back')
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/editions/odds.test.ts src/screens/Shop.test.tsx src/screens/Editor.test.tsx` → FAIL (missing `./odds`, `./Shop`; Editor `revealed` test gets `back`).

- [ ] **Step 3: Implement `src/editions/odds.ts`**

```ts
import { editions } from './registry'

/** Rounded percentage per edition; no usable weight means 100% Common. */
export function editionPercents(weights: Record<string, number>): Record<string, number> {
  const w = editions.map((e) => {
    const v = weights[e.id]
    return Number.isFinite(v) && v > 0 ? v : 0
  })
  const total = w.reduce((a, b) => a + b, 0)
  return Object.fromEntries(
    editions.map((e, i) => [e.id, total > 0 ? Math.round((w[i] / total) * 100) : e.id === 'common' ? 100 : 0]),
  )
}
```

Update `src/screens/OperatorPanel.tsx`: replace the `total`/`pct` lines with `const pct = editionPercents(weights)` (import from `'../editions/odds'`) and change `{pct(e.id)}%` to `{pct[e.id]}%`.

- [ ] **Step 4: Editor skips the reveal.** In `src/screens/Editor.tsx`, after the `edition` line add `const revealed = useBooth((s) => s.revealed)` and change the reveal call to:

```tsx
  const { phase, celebrate, skip } = useReveal(edition.rare, reducedMotion || revealed)
```

- [ ] **Step 5: Implement `src/screens/Shop.tsx`** (replaces `TemplatePicker.tsx`; delete that file)

```tsx
import { useEffect, useId, useMemo, useRef } from 'react'
import { editionPercents } from '../editions/odds'
import { editions } from '../editions/registry'
import { packArt } from '../packs/packArt'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { resolveDefaults } from '../templates/fields'
import { placeholderPhoto } from '../templates/placeholder'
import { templates } from '../templates/registry'
import type { Template } from '../templates/types'
import { TiltCard } from '../ui/TiltCard'
import { StampCanvas } from './StampCanvas'

const PACK_INFO = '3 different cards from one photo, each with its own edition. Keep 1.'

function CardTile({ template, delay }: { template: Template; delay: number }) {
  const infoId = useId()
  const selectTemplate = useBooth((s) => s.selectTemplate)
  const photo = useMemo(() => placeholderPhoto(template), [template])
  const values = useMemo(() => resolveDefaults(template), [template])
  return (
    <div className="tile">
      <div className="info" role="tooltip" id={infoId}>{template.description}</div>
      <TiltCard delay={delay}>
        <button className="tile-btn" aria-label={template.name} aria-describedby={infoId} onClick={() => selectTemplate(template.id)}>
          <StampCanvas template={template} photo={photo} values={values} scale={2} />
        </button>
      </TiltCard>
      <span className="tag" aria-hidden="true">{template.name}</span>
    </div>
  )
}

function PackTile() {
  const infoId = useId()
  const selectPack = useBooth((s) => s.selectPack)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) packArt(2, ref.current)
  }, [])
  return (
    <div className="tile">
      <div className="info" role="tooltip" id={infoId}>{PACK_INFO}</div>
      <TiltCard>
        <button className="tile-btn pack-btn" aria-label="Booster Pack" aria-describedby={infoId} onClick={selectPack}>
          <canvas ref={ref} className="stamp-canvas" aria-hidden="true" />
        </button>
      </TiltCard>
      <span className="tag" aria-hidden="true">Booster Pack</span>
    </div>
  )
}

function OddsPanel() {
  const weights = useOperator((s) => s.weights)
  const pct = editionPercents(weights)
  return (
    <section className="panel-box">
      <h3>Odds</h3>
      <ul className="odds">
        {editions.map((e) => (
          <li key={e.id} className="odds-row">
            <span className={`swatch swatch-${e.id}`} aria-hidden="true" />
            <span>{e.name}</span>
            <span data-testid={`odds-${e.id}`}>{pct[e.id]}%</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Shop() {
  return (
    <div className="shop">
      <div className="shop-main">
        <section className="panel-box tray" aria-labelledby="cards-title">
          <h3 id="cards-title">Cards</h3>
          <div className="felt">
            <div className="tile-grid">
              {templates.map((t, i) => (
                <CardTile key={t.id} template={t} delay={i * 0.35} />
              ))}
            </div>
          </div>
        </section>
        <section className="panel-box tray" aria-labelledby="packs-title">
          <h3 id="packs-title">Packs</h3>
          <div className="felt">
            <div className="tile-grid">
              <PackTile />
            </div>
          </div>
        </section>
      </div>
      <aside className="shop-side">
        <OddsPanel />
        <section className="panel-box">
          <h3>How it works</h3>
          <ol className="how">
            <li>Pick a card or a pack</li>
            <li>Strike a pose</li>
            <li>Keep, download or print</li>
          </ol>
        </section>
      </aside>
    </div>
  )
}
```

Update `src/App.tsx`: replace the `TemplatePicker` import with `import { Shop } from './screens/Shop'` and `{screen === 'picker' && <TemplatePicker />}` with `{screen === 'picker' && <Shop />}`.

- [ ] **Step 6: Styles** — in `src/index.css`, delete the `.picker-grid`, `.picker-card` (all three rules) and `.card-label` rules; change `.tilt-inner, .picker-card { max-width: 100%; }` to `.tilt-inner { max-width: 100%; }`; in the reduced-motion block change `.btn, .picker-card { transition: none; }` to `.btn, .tile-btn { transition: none; }`. Add after the `@keyframes bob` line:

```css
/* Shop */
.shop { display: grid; grid-template-columns: 1fr 230px; gap: 20px; align-items: start; width: 100%; }
.shop-main, .shop-side { display: grid; gap: 20px; min-width: 0; }
.panel-box {
  background: var(--panel); border: 3px solid var(--dark); border-radius: 10px; box-shadow: 0 6px 0 var(--dark);
  padding: 14px; min-width: 0;
}
.panel-box h3 { margin: 0 0 10px; font: 700 22px var(--font); text-shadow: 2px 2px 0 var(--dark); }
.felt {
  background-color: #1f6b4a;
  background-image: radial-gradient(rgb(0 0 0 / 0.18) 1px, transparent 1px);
  background-size: 6px 6px;
  border: 3px solid var(--dark); border-radius: 8px; box-shadow: inset 0 4px 0 rgb(0 0 0 / 0.3);
  padding: 28px 16px 18px;
}
.tile-grid { display: flex; flex-wrap: wrap; gap: 26px 22px; justify-content: center; align-items: flex-end; }
.tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0; max-width: 100%; }
.tile-btn {
  display: block; background: none; border: 0; padding: 0; cursor: pointer; max-width: 100%;
  transition: transform 120ms ease-out, filter 120ms ease-out;
}
.tile-btn canvas { width: auto; height: auto; max-width: 100%; max-height: 200px; }
.tile-btn:hover, .tile-btn:focus-visible { transform: scale(1.06); filter: drop-shadow(0 10px 0 rgb(0 0 0 / 0.35)); outline: none; }
.tile-btn:focus-visible { outline: 3px solid var(--gold); outline-offset: 4px; }
.tag {
  font: 700 16px var(--font); color: var(--dark); background: var(--gold);
  border: 3px solid var(--dark); border-radius: 6px; padding: 2px 10px; box-shadow: 0 3px 0 var(--dark);
}
.info {
  position: absolute; bottom: calc(100% + 6px); left: 50%; translate: -50% 0; z-index: 5;
  width: max-content; max-width: min(240px, 80vw); padding: 8px 10px;
  background: var(--dark); color: var(--ink); border: 3px solid var(--ink); border-radius: 6px;
  font-size: 15px; line-height: 1.3; text-align: center;
  opacity: 0; pointer-events: none; transition: opacity 120ms;
}
.tile:hover .info, .tile:focus-within .info { opacity: 1; }
.pack-btn { position: relative; overflow: hidden; }
.pack-btn::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen;
  background: linear-gradient(115deg, transparent 35%, rgb(255 255 255 / 0.45) 50%, transparent 65%);
  background-size: 300% 100%; animation: sheen 3.5s ease-in-out infinite;
}
@keyframes sheen { from { background-position: 150% 0; } to { background-position: -50% 0; } }
.odds, .how { margin: 0; padding: 0; display: grid; gap: 8px; }
.odds { list-style: none; }
.how { padding-left: 1.4em; }
.odds-row { display: grid; grid-template-columns: 14px 1fr auto; gap: 8px; align-items: center; font-weight: 700; }
.swatch { width: 14px; height: 14px; border: 2px solid var(--dark); }
.swatch-common { background: #c9c3b4; }
.swatch-foil { background: linear-gradient(135deg, #b9c2d0, #fff, #b9c2d0); }
.swatch-holo { background: linear-gradient(135deg, #ff6b9d, #ffd36b, #6bffb8, #6bb8ff); }
.swatch-poly { background: conic-gradient(#ff5e5e, #ffd35e, #5eff8a, #5ec8ff, #b65eff, #ff5e5e); }
@media (max-width: 719px) {
  .shop { grid-template-columns: 1fr; }
  .tile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); justify-items: center; }
  .tile-btn canvas { max-height: 150px; }
}
```

and inside the reduced-motion block add `.pack-btn::after { animation: none; display: none; }`.

- [ ] **Step 7: Run tests** — `npm test` → all pass (the old operator-panel tests still pass via `editionPercents`); `npx tsc -b`, `npm run lint` → clean.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat: add card-shop homepage with odds panel and booster pack; skip editor reveal after a pack pick"
```

---

### Task 8: README and verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README** — in the "Card editions" section, after its first paragraph add:

```markdown
**Booster packs:** choose the Booster Pack on the home screen to take one photo and get three different cards, each with its own edition — keep the one you like. Text you type for a card type (like an event name on the Ticket) is remembered and used whenever that card is dealt.
```

- [ ] **Step 2: Full verification**

Run: `npm test && npm run build && npm run lint && git status`.

In headless Chrome (fake camera) against `npm run dev`, then `npm run preview`:
1. Home at 1280 px and 375 px: tray, tags, packs row, odds, how-it-works; no horizontal scroll at 375 px; Tab focus on a card shows its info box.
2. Booster Pack → booth shows "Booster Pack" viewfinder → Take photo → three cards slide in and flip; a rare one glints.
3. Pick one → editor shows it already revealed with shimmer; downloaded PNG crops the photo to that card's frame (check one portrait and one landscape card).
4. Set the Ticket event to "GRAD NIGHT" via a direct Ticket capture, then run packs until a Ticket is dealt → it shows "GRAD NIGHT".
5. Reduced motion: deal shows three face-up cards immediately.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document booster packs and remembered card text"
```
