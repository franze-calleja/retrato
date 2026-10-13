# Card Editions & Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every capture rolls a card edition (Common/Foil/Holo/Polychrome) that adds a pixel shimmer to the frame only, revealed with a card flip; operators tune odds or force an edition from a hidden panel.

**Architecture:** A new `src/editions` module (one file per edition + registry + weighted roll) produces art-resolution overlay `ImageData`. `composeStamp` gains `{ edition, angle }` options and paints the overlay onto the frame art with `source-atop` before the photo is drawn, so the photo is untouched. A persisted Zustand operator store feeds the roll; the booth store rolls on capture. The Editor wraps the card in a CSS 3D flip driven by a `useReveal` hook and a `ShimmerCard` that animates the angle.

**Tech Stack:** Existing project — Vite 8, React 19.2, TypeScript 6, Zustand 5, Vitest 4 + jsdom + vitest-canvas-mock, @testing-library/react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-13-card-editions-design.md` (base spec: `docs/superpowers/specs/2026-10-13-pixel-booth-design.md`)

## Global Constraints

- The photo must never be affected by edition effects: overlay is drawn on frame art only; photo `drawImage` stays the last draw in `composeStamp`.
- Default weights: common 60, foil 25, holo 12, poly 3. Rare editions: holo, poly.
- Badges: foil `★ FOIL`, holo `★ HOLO`, poly `★★ POLY`; common has none.
- `SNAPSHOT_ANGLE = 0.35` for download/print and reduced motion. Angles are in `[0, 1)`, quantized to 64 steps.
- Reveal timings: back 250 ms → flip 600 ms → shown; rare celebration 1200 ms.
- Operator settings key: `pixel-booth:operator`. Weights clamped to 0–100. Storage errors never throw.
- The booth preview stays Common (no edition) — the edition is a surprise.
- All motion disabled under `prefers-reduced-motion: reduce`.
- No new dependencies. Commit style: Conventional Commits; no AI attribution lines.
- Work on branch `feat/card-editions`.

## Review Focus

1. **Storage blocked or corrupt** (Safari private mode, sandboxed iframe, hand-edited JSON) — app must load, panel works in memory, odds fall back to defaults. Pinned in Task 2.
2. **Operator changes odds between captures** — Retake + capture must roll with the *current* settings; editing text must never re-roll. Pinned in Task 3.
3. **Leaving the editor mid-reveal or mashing keys/clicks during the flip** — no timers firing after unmount, skip is idempotent. Pinned in Task 5.
4. **Photo untouched by effects** — photo drawn after overlay, at the same rect. Pinned in Task 4.
5. **All weights zero / garbage values** — roll returns Common, panel shows 100% Common, no crash. Pinned in Tasks 1 and 7.

---

## File Structure

```
src/
  editions/
    types.ts            Edition interface
    effects.ts          overlay(), diag(), fract(), step(), hsl()
    common.ts foil.ts holo.ts poly.ts
    registry.ts         editions, getEdition, DEFAULT_WEIGHTS
    roll.ts             EditionSettings, rollEdition
    angle.ts            SNAPSHOT_ANGLE, quantizeAngle, angleFor, driftAngle
    apply.ts            applyEdition (overlay + badge), drawBadge
    editions.test.ts    roll.test.ts    angle.test.ts
  store/
    operator.ts         persisted operator settings
    operator.test.ts
    booth.ts            (modify) edition field + roll on capture
    booth.test.ts       (modify)
  render/
    composeStamp.ts     (modify) opts { edition, angle }
    composeStamp.test.ts (modify)
    cardBack.ts         generic pixel card back
    cardBack.test.ts
  templates/
    pixelFont.ts        (modify) add ★ glyph
  screens/
    useReveal.ts        reveal phase hook
    useReveal.test.ts
    ShimmerCard.tsx     live edition shimmer canvas
    Editor.tsx          (modify) reveal + shimmer + edition in exports
    OperatorPanel.tsx
    OperatorPanel.test.tsx
  ui/
    taps.ts             registerTap (pure)
    taps.test.ts
    motion.ts           prefersReducedMotion()
  App.tsx               (modify) secret taps, shortcut, panel
  index.css             (modify) reveal, banner, sparkles, panel styles
```

---

### Task 1: Edition model and roll

**Files:**
- Create: `src/editions/types.ts`, `src/editions/effects.ts`, `src/editions/common.ts`, `src/editions/foil.ts`, `src/editions/holo.ts`, `src/editions/poly.ts`, `src/editions/registry.ts`, `src/editions/roll.ts`, `src/editions/editions.test.ts`, `src/editions/roll.test.ts`
- Modify: `src/templates/pixelFont.ts` (add `★`)

**Interfaces:**
- Produces:
  - `interface Edition { id: string; name: string; defaultWeight: number; badge?: string; rare: boolean; hasEffect: boolean; overlay(w: number, h: number, angle: number): ImageData | null }`
  - `effects.ts`: `fract(v)`, `step(v, levels)`, `diag(x, y, w, h)`, `hsl(h, s, l): [number, number, number]`, `overlay(w, h, pixel: (x, y) => readonly [number, number, number, number] | null): ImageData` (alpha component 0–1)
  - `registry.ts`: `editions: readonly Edition[]` (order: common, foil, holo, poly), `getEdition(id: string | null | undefined): Edition` (unknown → common), `DEFAULT_WEIGHTS: Record<string, number>`
  - `roll.ts`: `interface EditionSettings { weights: Record<string, number>; forced: string }` (`forced` is `'random'` or an edition id), `rollEdition(settings: EditionSettings, rand?: () => number): string`

- [ ] **Step 1: Write failing tests.** `src/editions/roll.test.ts`:

```ts
import { expect, test } from 'vitest'
import { rollEdition } from './roll'

const w = (weights: Record<string, number>, forced = 'random') => ({ weights, forced })

test('weighted pick across cumulative boundaries', () => {
  const s = w({ common: 1, foil: 1, holo: 0, poly: 0 })
  expect(rollEdition(s, () => 0)).toBe('common')
  expect(rollEdition(s, () => 0.49)).toBe('common')
  expect(rollEdition(s, () => 0.5)).toBe('foil')
  expect(rollEdition(s, () => 0.999)).toBe('foil')
})

test('forced edition wins regardless of weights', () => {
  expect(rollEdition(w({ common: 100, foil: 0, holo: 0, poly: 0 }, 'holo'), () => 0)).toBe('holo')
})

test('unknown forced id falls back to random', () => {
  expect(rollEdition(w({ common: 0, foil: 1, holo: 0, poly: 0 }, 'nope'), () => 0.3)).toBe('foil')
})

test('all-zero weights give common', () => {
  expect(rollEdition(w({ common: 0, foil: 0, holo: 0, poly: 0 }), () => 0.7)).toBe('common')
})

test('negative, NaN and missing weights count as 0', () => {
  expect(rollEdition(w({ common: -5, foil: Number.NaN, holo: 2 }), () => 0.5)).toBe('holo')
})

test('rand() of exactly 1 still returns a weighted edition', () => {
  expect(rollEdition(w({ common: 0, foil: 3, holo: 0, poly: 0 }), () => 1)).toBe('foil')
})
```

`src/editions/editions.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { GLYPHS } from '../templates/pixelFont'
import { hsl } from './effects'
import { DEFAULT_WEIGHTS, editions, getEdition } from './registry'

test('registry order, unique ids, default weights', () => {
  expect(editions.map((e) => e.id)).toEqual(['common', 'foil', 'holo', 'poly'])
  expect(DEFAULT_WEIGHTS).toEqual({ common: 60, foil: 25, holo: 12, poly: 3 })
})

test('getEdition falls back to common', () => {
  expect(getEdition('holo').id).toBe('holo')
  expect(getEdition('nope').id).toBe('common')
  expect(getEdition(undefined).id).toBe('common')
})

test('rare flags and badges', () => {
  expect(editions.filter((e) => e.rare).map((e) => e.id)).toEqual(['holo', 'poly'])
  expect(editions.map((e) => e.badge)).toEqual([undefined, '★ FOIL', '★ HOLO', '★★ POLY'])
})

test('badge text only uses glyphs the bitmap font has', () => {
  for (const e of editions) for (const ch of e.badge ?? '') expect(GLYPHS[ch], `${e.id} ${ch}`).toBeDefined()
})

test('hsl converts primaries', () => {
  expect(hsl(0, 1, 0.5)).toEqual([255, 0, 0])
  expect(hsl(1 / 3, 1, 0.5)).toEqual([0, 255, 0])
})

describe.each(editions.map((e) => [e.id, e] as const))('edition %s', (_id, e) => {
  test('overlay matches hasEffect and has w × h size', () => {
    const img = e.overlay(40, 30, 0.2)
    if (!e.hasEffect) return expect(img).toBeNull()
    expect([img?.width, img?.height]).toEqual([40, 30])
  })
  test('effect changes with angle', () => {
    if (!e.hasEffect) return
    const a = e.overlay(40, 30, 0.1)!.data.join(',')
    const b = e.overlay(40, 30, 0.6)!.data.join(',')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/editions` → Expected: FAIL, cannot resolve `./roll` / `./registry`.

- [ ] **Step 3: Add the star glyph.** In `src/templates/pixelFont.ts`, add to `GLYPHS` after the `'¢'` entry:

```ts
  '★': ['010', '111', '010', '101', '000'],
```

- [ ] **Step 4: Implement `src/editions/types.ts`**

```ts
export interface Edition {
  id: string
  name: string
  defaultWeight: number
  /** Pixel sticker text drawn on the frame; none for common. */
  badge?: string
  /** Rare editions get the banner + sparkle reveal. */
  rare: boolean
  /** False when overlay() always returns null (no shimmer to animate). */
  hasEffect: boolean
  /** Art-resolution RGBA overlay for a shimmer angle in [0, 1); applied to frame pixels only. */
  overlay(w: number, h: number, angle: number): ImageData | null
}
```

- [ ] **Step 5: Implement `src/editions/effects.ts`**

```ts
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
```

- [ ] **Step 6: Implement the four editions**

`src/editions/common.ts`:

```ts
import type { Edition } from './types'

export const common: Edition = {
  id: 'common',
  name: 'Common',
  defaultWeight: 60,
  rare: false,
  hasEffect: false,
  overlay: () => null,
}
```

`src/editions/foil.ts`:

```ts
import { diag, overlay, step } from './effects'
import type { Edition } from './types'

const BAND = 0.14

export const foil: Edition = {
  id: 'foil',
  name: 'Foil',
  defaultWeight: 25,
  badge: '★ FOIL',
  rare: false,
  hasEffect: true,
  overlay(w, h, angle) {
    const center = angle * 1.6 - 0.3
    return overlay(w, h, (x, y) => {
      const t = 1 - Math.abs(diag(x, y, w, h) - center) / BAND
      return t > 0 ? [255, 255, 255, step(t, 3) * 0.6] : [215, 222, 235, 0.08]
    })
  },
}
```

`src/editions/holo.ts`:

```ts
import { diag, fract, hsl, overlay, step } from './effects'
import type { Edition } from './types'

export const holo: Edition = {
  id: 'holo',
  name: 'Holographic',
  defaultWeight: 12,
  badge: '★ HOLO',
  rare: true,
  hasEffect: true,
  overlay(w, h, angle) {
    return overlay(w, h, (x, y) => {
      const [r, g, b] = hsl(step(fract(diag(x, y, w, h) * 2.5 + angle), 6), 0.9, 0.6)
      return [r, g, b, 0.32]
    })
  },
}
```

`src/editions/poly.ts`:

```ts
import { diag, fract, hsl, overlay, step } from './effects'
import type { Edition } from './types'

const hash = (x: number, y: number) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)

export const poly: Edition = {
  id: 'poly',
  name: 'Polychrome',
  defaultWeight: 3,
  badge: '★★ POLY',
  rare: true,
  hasEffect: true,
  overlay(w, h, angle) {
    return overlay(w, h, (x, y) => {
      const n = hash(x, y)
      if (n > 0.985 && fract(n * 7 + angle * 3) > 0.6) return [255, 255, 255, 0.95]
      const [r, g, b] = hsl(step(fract(diag(x, y, w, h) * 1.5 + (y / h) * 0.5 + angle * 1.5), 8), 1, 0.6)
      return [r, g, b, 0.45]
    })
  },
}
```

- [ ] **Step 7: Implement `src/editions/registry.ts`**

```ts
import { common } from './common'
import { foil } from './foil'
import { holo } from './holo'
import { poly } from './poly'
import type { Edition } from './types'

export const editions: readonly Edition[] = [common, foil, holo, poly]

export function getEdition(id: string | null | undefined): Edition {
  return editions.find((e) => e.id === id) ?? common
}

export const DEFAULT_WEIGHTS: Record<string, number> = Object.fromEntries(editions.map((e) => [e.id, e.defaultWeight]))
```

- [ ] **Step 8: Implement `src/editions/roll.ts`**

```ts
import { editions } from './registry'

export interface EditionSettings {
  weights: Record<string, number>
  /** 'random' or an edition id. */
  forced: string
}

export function rollEdition(settings: EditionSettings, rand: () => number = Math.random): string {
  if (settings.forced !== 'random' && editions.some((e) => e.id === settings.forced)) return settings.forced
  const weights = editions.map((e) => {
    const v = settings.weights[e.id]
    return Number.isFinite(v) && v > 0 ? v : 0
  })
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 'common'
  let r = rand() * total
  let last = 'common'
  for (let i = 0; i < editions.length; i++) {
    if (weights[i] <= 0) continue
    last = editions[i].id
    if (r < weights[i]) return last
    r -= weights[i]
  }
  return last // rand() === 1 or float drift
}
```

- [ ] **Step 9: Run tests**

Run: `npm test` → Expected: all pass (existing 62 + new).

- [ ] **Step 10: Commit**

```bash
git add src/editions src/templates/pixelFont.ts
git commit -m "feat: add card editions with frame shimmer overlays and weighted roll"
```

---

### Task 2: Operator settings store

**Files:**
- Create: `src/store/operator.ts`, `src/store/operator.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_WEIGHTS`, `editions`, `EditionSettings`
- Produces: `OPERATOR_KEY = 'pixel-booth:operator'`, `defaultSettings(): EditionSettings`, `sanitize(raw: unknown): EditionSettings`, `loadSettings(): EditionSettings`, `useOperator` with state `EditionSettings` + `setWeight(id: string, weight: number)`, `setForced(forced: string)`, `reset()`

- [ ] **Step 1: Write failing tests** `src/store/operator.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OPERATOR_KEY, defaultSettings, loadSettings, sanitize, useOperator } from './operator'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

test('defaults', () => {
  expect(defaultSettings()).toEqual({ weights: { common: 60, foil: 25, holo: 12, poly: 3 }, forced: 'random' })
})

test('setWeight and setForced persist; loadSettings restores them', () => {
  useOperator.getState().setWeight('holo', 50)
  useOperator.getState().setForced('poly')
  expect(JSON.parse(localStorage.getItem(OPERATOR_KEY)!)).toEqual({
    weights: { common: 60, foil: 25, holo: 50, poly: 3 },
    forced: 'poly',
  })
  expect(loadSettings()).toEqual({ weights: { common: 60, foil: 25, holo: 50, poly: 3 }, forced: 'poly' })
})

test('setWeight clamps to 0–100 and ignores unknown editions', () => {
  useOperator.getState().setWeight('foil', 500)
  useOperator.getState().setWeight('common', -3)
  useOperator.getState().setWeight('nope', 10)
  expect(useOperator.getState().weights).toEqual({ common: 0, foil: 100, holo: 12, poly: 3 })
})

test('setForced ignores unknown ids', () => {
  useOperator.getState().setForced('nope')
  expect(useOperator.getState().forced).toBe('random')
})

test('reset restores defaults and persists them', () => {
  useOperator.getState().setWeight('poly', 90)
  useOperator.getState().reset()
  expect(useOperator.getState().weights.poly).toBe(3)
  expect(loadSettings().weights.poly).toBe(3)
})

test('sanitize: corrupt shapes and values fall back per field', () => {
  expect(sanitize(null)).toEqual(defaultSettings())
  expect(sanitize('x')).toEqual(defaultSettings())
  expect(sanitize({ weights: { common: 'a', foil: -4, holo: 101, extra: 9 }, forced: 'nope' })).toEqual({
    weights: { common: 60, foil: 0, holo: 100, poly: 3 },
    forced: 'random',
  })
})

test('corrupt stored JSON loads defaults', () => {
  localStorage.setItem(OPERATOR_KEY, '{nope')
  expect(loadSettings()).toEqual(defaultSettings())
})

test('storage that throws never breaks reads or writes', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(loadSettings()).toEqual(defaultSettings())
  expect(() => useOperator.getState().setWeight('foil', 40)).not.toThrow()
  expect(useOperator.getState().weights.foil).toBe(40)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/operator.test.ts` → Expected: FAIL, cannot resolve `./operator`.

- [ ] **Step 3: Implement `src/store/operator.ts`**

```ts
import { create } from 'zustand'
import { DEFAULT_WEIGHTS, editions } from '../editions/registry'
import type { EditionSettings } from '../editions/roll'

export const OPERATOR_KEY = 'pixel-booth:operator'

const isEdition = (id: unknown): id is string => editions.some((e) => e.id === id)
const clampWeight = (v: number) => Math.min(100, Math.max(0, v))

export const defaultSettings = (): EditionSettings => ({ weights: { ...DEFAULT_WEIGHTS }, forced: 'random' })

export function sanitize(raw: unknown): EditionSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as { weights?: unknown; forced?: unknown }
  const stored = (src.weights && typeof src.weights === 'object' ? src.weights : {}) as Record<string, unknown>
  const weights = Object.fromEntries(
    editions.map((e) => {
      const v = stored[e.id]
      return [e.id, typeof v === 'number' && Number.isFinite(v) ? clampWeight(v) : DEFAULT_WEIGHTS[e.id]]
    }),
  )
  const forced = src.forced === 'random' || isEdition(src.forced) ? (src.forced as string) : 'random'
  return { weights, forced }
}

// localStorage can be missing or throw (private mode, sandboxed iframes, quota); settings then live in memory.
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadSettings(): EditionSettings {
  try {
    const raw = storage()?.getItem(OPERATOR_KEY)
    return sanitize(raw ? JSON.parse(raw) : null)
  } catch {
    return defaultSettings()
  }
}

function save({ weights, forced }: EditionSettings) {
  try {
    storage()?.setItem(OPERATOR_KEY, JSON.stringify({ weights, forced }))
  } catch {
    // Keep working in memory.
  }
}

interface OperatorState extends EditionSettings {
  setWeight(id: string, weight: number): void
  setForced(forced: string): void
  reset(): void
}

export const useOperator = create<OperatorState>()((set, get) => ({
  ...loadSettings(),
  setWeight(id, weight) {
    if (!isEdition(id) || !Number.isFinite(weight)) return
    set({ weights: { ...get().weights, [id]: clampWeight(weight) } })
    save(get())
  },
  setForced(forced) {
    if (forced !== 'random' && !isEdition(forced)) return
    set({ forced })
    save(get())
  },
  reset() {
    set(defaultSettings())
    save(get())
  },
}))
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/store` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/store/operator.ts src/store/operator.test.ts
git commit -m "feat: add persisted operator settings for edition odds"
```

---

### Task 3: Roll the edition on capture

**Files:**
- Modify: `src/store/booth.ts`, `src/store/booth.test.ts`

**Interfaces:**
- Consumes: `rollEdition`, `useOperator`
- Produces: booth state gains `edition: string` (edition id; `'common'` until a capture)

- [ ] **Step 1: Write failing tests** — add `import { useOperator } from './operator'` to the imports at the top of `src/store/booth.test.ts`, then append:

```ts
describe('editions', () => {
  beforeEach(() => {
    localStorage.clear()
    useOperator.getState().reset()
  })

  test('capture rolls the edition from operator settings', () => {
    useOperator.getState().setForced('holo')
    s().selectTemplate('stamp')
    s().setCapture(photo())
    expect(s().edition).toBe('holo')
  })

  test('editing text keeps the edition', () => {
    useOperator.getState().setForced('foil')
    s().setCapture(photo())
    useOperator.getState().setForced('poly')
    s().setValue('title', 'CHANGED')
    expect(s().edition).toBe('foil')
  })

  test('retake then capture rolls again with the current settings', () => {
    useOperator.getState().setForced('foil')
    s().setCapture(photo())
    useOperator.getState().setForced('poly')
    s().retake()
    expect(s().edition).toBe('common')
    s().setCapture(photo())
    expect(s().edition).toBe('poly')
  })

  test('changing template clears the edition', () => {
    useOperator.getState().setForced('holo')
    s().setCapture(photo())
    s().selectTemplate('voucher')
    expect(s().edition).toBe('common')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/booth.test.ts` → Expected: FAIL — `edition` is `undefined`.

- [ ] **Step 3: Implement** — in `src/store/booth.ts`:

Add imports:

```ts
import { rollEdition } from '../editions/roll'
import { useOperator } from './operator'
```

Add `edition: string` to `BoothState` (after `capture`), initial value `edition: 'common',`, and change these actions:

```ts
  selectTemplate(id) {
    const same = id === get().templateId
    set({
      templateId: id,
      values: same ? get().values : resolveDefaults(getTemplate(id)),
      capture: null,
      edition: 'common',
      screen: 'booth',
    })
  },
  setCapture(photo) {
    const t = getTemplate(get().templateId)
    set({
      capture: photo,
      edition: rollEdition(useOperator.getState()),
      values: refreshPerCapture(t, get().values),
      screen: 'editor',
    })
  },
  retake: () => set({ capture: null, edition: 'common', screen: 'booth' }),
  goToPicker: () => set({ capture: null, edition: 'common', screen: 'picker' }),
```

- [ ] **Step 4: Run tests**

Run: `npm test` → Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/store/booth.ts src/store/booth.test.ts
git commit -m "feat: roll a card edition on each capture"
```

---

### Task 4: Render editions (angle, overlay, badge, card back)

**Files:**
- Create: `src/editions/angle.ts`, `src/editions/angle.test.ts`, `src/editions/apply.ts`, `src/render/cardBack.ts`, `src/render/cardBack.test.ts`
- Modify: `src/render/composeStamp.ts`, `src/render/composeStamp.test.ts`

**Interfaces:**
- Consumes: `Edition`, draw helpers, colors, `drawText`, `measureText`, `withDropShadow`, `panel`
- Produces:
  - `angle.ts`: `SNAPSHOT_ANGLE = 0.35`, `quantizeAngle(a: number): number` (64 steps, result in `[0, 1)`), `angleFor(clientX, clientY, rect: { left; top; width; height }): number`, `driftAngle(ms: number): number` (one sweep per 20 s, starting at `SNAPSHOT_ANGLE`)
  - `apply.ts`: `applyEdition(ctx, edition: Edition, w: number, h: number, angle: number): void`, `drawBadge(ctx, text: string): void`
  - `composeStamp(template, photo, values, scale, target?, opts?: { edition?: Edition; angle?: number })`
  - `cardBack(template: Template, scale: number, target?: HTMLCanvasElement): HTMLCanvasElement`

- [ ] **Step 1: Write failing tests.** `src/editions/angle.test.ts`:

```ts
import { expect, test } from 'vitest'
import { SNAPSHOT_ANGLE, angleFor, driftAngle, quantizeAngle } from './angle'

test('quantizeAngle snaps to 64 steps and wraps into [0, 1)', () => {
  expect(quantizeAngle(0.1)).toBe(quantizeAngle(0.1004))
  expect(quantizeAngle(0.1)).not.toBe(quantizeAngle(0.6))
  expect(quantizeAngle(1)).toBe(0)
  expect(quantizeAngle(-0.25)).toBe(0.75)
  expect(quantizeAngle(0.999)).toBe(0)
})

test('angleFor maps the card diagonal to 0..1 and clamps', () => {
  const rect = { left: 0, top: 0, width: 100, height: 200 }
  expect(angleFor(0, 0, rect)).toBe(0)
  expect(angleFor(100, 200, rect)).toBe(1)
  expect(angleFor(50, 100, rect)).toBe(0.5)
  expect(angleFor(-50, 900, rect)).toBe(0.5)
})

test('driftAngle starts at the snapshot angle and loops every 20 s', () => {
  expect(driftAngle(0)).toBeCloseTo(SNAPSHOT_ANGLE)
  expect(driftAngle(20_000)).toBeCloseTo(SNAPSHOT_ANGLE)
  expect(driftAngle(10_000)).toBeCloseTo(0.85)
})
```

`src/render/cardBack.test.ts`:

```ts
import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { cardBack } from './cardBack'

test.each(templates.map((t) => [t.id, t] as const))('%s card back is template size × scale', (_id, t) => {
  const c = cardBack(t, 3)
  expect([c.width, c.height]).toEqual([t.size.w * 3, t.size.h * 3])
})

test('draws into a provided target', () => {
  const target = document.createElement('canvas')
  expect(cardBack(templates[0], 2, target)).toBe(target)
})
```

Add `import { getEdition } from '../editions/registry'` to the imports at the top of `src/render/composeStamp.test.ts`, then append:

```ts
test('edition overlay is applied before the photo, and the photo is drawn last into photoRect × scale', () => {
  const holo = getEdition('holo')
  const overlay = vi.spyOn(holo, 'overlay')
  const target = document.createElement('canvas')
  const ctx = target.getContext('2d')!
  const drawImage = vi.spyOn(ctx, 'drawImage')
  composeStamp(t, photo, { title: 'EDITION ORDER' }, 4, target, { edition: holo, angle: 0.2 })
  expect(overlay).toHaveBeenCalled()
  const last = drawImage.mock.calls.at(-1)!
  const r = t.photoRect
  expect(last[0]).toBe(photo.source)
  expect(last.slice(5)).toEqual([r.x * 4, r.y * 4, r.w * 4, r.h * 4])
  overlay.mockRestore()
})

test('art cache distinguishes edition and quantized angle', () => {
  const render = vi.spyOn(t, 'render')
  const values = { title: 'CACHE EDITION' }
  const holo = getEdition('holo')
  composeStamp(t, photo, values, 1, undefined, { edition: holo, angle: 0.1 })
  composeStamp(t, photo, values, 1, undefined, { edition: holo, angle: 0.1004 })
  expect(render).toHaveBeenCalledTimes(1)
  composeStamp(t, photo, values, 1, undefined, { edition: holo, angle: 0.6 })
  expect(render).toHaveBeenCalledTimes(2)
  composeStamp(t, photo, values, 1, undefined, { edition: getEdition('foil'), angle: 0.6 })
  expect(render).toHaveBeenCalledTimes(3)
  render.mockRestore()
})

test('common edition ignores angle for caching', () => {
  const render = vi.spyOn(t, 'render')
  const values = { title: 'CACHE COMMON' }
  composeStamp(t, photo, values, 1, undefined, { edition: getEdition('common'), angle: 0.1 })
  composeStamp(t, photo, values, 1, undefined, { edition: getEdition('common'), angle: 0.9 })
  expect(render).toHaveBeenCalledTimes(1)
  render.mockRestore()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/editions/angle.test.ts src/render` → Expected: FAIL — missing `./angle`, `./cardBack`; the edition tests fail because `opts` is ignored.

- [ ] **Step 3: Implement `src/editions/angle.ts`**

```ts
import { fract } from './effects'

/** Angle used for downloads, prints, and reduced motion. */
export const SNAPSHOT_ANGLE = 0.35
const STEPS = 64
const DRIFT_MS = 20_000

export function quantizeAngle(a: number): number {
  return fract(Math.round(fract(a) * STEPS) / STEPS)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function angleFor(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): number {
  return (clamp01((clientX - rect.left) / rect.width) + clamp01((clientY - rect.top) / rect.height)) / 2
}

export function driftAngle(ms: number): number {
  return fract(SNAPSHOT_ANGLE + ms / DRIFT_MS)
}
```

- [ ] **Step 4: Implement `src/editions/apply.ts`**

```ts
import { GOLD, OUTLINE } from '../templates/colors'
import { panel } from '../templates/draw'
import { drawText, measureText } from '../templates/pixelFont'
import type { Edition } from './types'

/** Small gold sticker at the art's top-left corner. */
export function drawBadge(ctx: CanvasRenderingContext2D, text: string) {
  const tw = measureText(text)
  panel(ctx, OUTLINE, 0, 0, tw + 6, 9, 2)
  panel(ctx, GOLD, 1, 1, tw + 4, 7, 1)
  drawText(ctx, text, 3, 2, OUTLINE)
}

/** Paints the edition shimmer onto opaque frame pixels only, then the badge. */
export function applyEdition(ctx: CanvasRenderingContext2D, edition: Edition, w: number, h: number, angle: number) {
  const img = edition.overlay(w, h, angle)
  if (img) {
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    ctx.save()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.drawImage(tmp, 0, 0)
    ctx.restore()
  }
  if (edition.badge) drawBadge(ctx, edition.badge)
}
```

- [ ] **Step 5: Update `src/render/composeStamp.ts`** — replace the cache + `frameArt` + signature:

```ts
import { quantizeAngle } from '../editions/angle'
import { applyEdition } from '../editions/apply'
import type { Edition } from '../editions/types'
import { drawCover, type PhotoSource } from '../photo/crop'
import type { Template } from '../templates/types'

export interface ComposeOptions {
  edition?: Edition
  /** Shimmer angle in [0, 1); quantized so the live shimmer reuses cached art. */
  angle?: number
}

// Last rendered frame art per template. The live preview composes every animation frame;
// re-rendering the frame (and its shadow canvases) only when text, edition or angle step changes keeps that cheap.
const artCache = new Map<string, { key: string; canvas: HTMLCanvasElement }>()

function frameArt(template: Template, values: Record<string, string>, opts: ComposeOptions): HTMLCanvasElement {
  const edition = opts.edition
  const angle = edition?.hasEffect ? quantizeAngle(opts.angle ?? 0) : 0
  const key = JSON.stringify([template.fields.map((f) => values[f.key] ?? null), edition?.id ?? null, angle])
  const cached = artCache.get(template.id)
  if (cached?.key === key) return cached.canvas

  const canvas = document.createElement('canvas')
  canvas.width = template.size.w
  canvas.height = template.size.h
  const ctx = canvas.getContext('2d')!
  template.render(ctx, values)
  if (edition) applyEdition(ctx, edition, canvas.width, canvas.height, angle)
  artCache.set(template.id, { key, canvas })
  return canvas
}
```

and in `composeStamp` add the parameter `opts: ComposeOptions = {}` after `target?: HTMLCanvasElement,` and change `const art = frameArt(template, values)` to `const art = frameArt(template, values, opts)`. Update the doc comment's first line to: `Frame art (with any edition shimmer) is drawn at art scale and upscaled with no smoothing (crisp pixels);`.

- [ ] **Step 6: Implement `src/render/cardBack.ts`**

```ts
import { BLUE_DARK, CREAM, OUTLINE, RED, SHADOW } from '../templates/colors'
import { fill, panel, withDropShadow } from '../templates/draw'
import { drawTextCentered } from '../templates/pixelFont'
import type { Template } from '../templates/types'

// Every template reserves a 3-art-pixel drop-shadow margin on the right and bottom.
const SHADOW_OFFSET = 3

function body(ctx: CanvasRenderingContext2D, w: number, h: number) {
  panel(ctx, OUTLINE, 0, 0, w, h, 3)
  panel(ctx, RED, 1, 1, w - 2, h - 2, 2)
  for (let y = 4; y < h - 4; y++) {
    for (let x = 4; x < w - 4; x++) {
      if ((x + y) % 8 === 0 || (x - y + 8 * h) % 8 === 0) fill(ctx, BLUE_DARK, x, y, 1, 1)
    }
  }
  const cx = Math.floor(w / 2)
  const cy = Math.floor(h / 2)
  panel(ctx, OUTLINE, cx - 15, cy - 11, 30, 22, 2)
  panel(ctx, CREAM, cx - 14, cy - 10, 28, 20, 1)
  drawTextCentered(ctx, 'PIXEL', cx, cy - 7, OUTLINE)
  drawTextCentered(ctx, 'BOOTH', cx, cy + 2, OUTLINE)
}

export function cardBack(template: Template, scale: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const { w, h } = template.size
  const art = document.createElement('canvas')
  art.width = w
  art.height = h
  withDropShadow(art.getContext('2d')!, w - SHADOW_OFFSET, h - SHADOW_OFFSET, SHADOW_OFFSET, SHADOW, (c) =>
    body(c, w - SHADOW_OFFSET, h - SHADOW_OFFSET),
  )
  const out = target ?? document.createElement('canvas')
  out.width = w * scale
  out.height = h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(art, 0, 0, out.width, out.height)
  return out
}
```

- [ ] **Step 7: Run tests**

Run: `npm test` → Expected: all pass. Run `npx tsc -b` → no errors.

- [ ] **Step 8: Commit**

```bash
git add src/editions src/render
git commit -m "feat: render edition shimmer and badge on frame art; add card back"
```

---

### Task 5: Reveal phase hook

**Files:**
- Create: `src/ui/motion.ts`, `src/screens/useReveal.ts`, `src/screens/useReveal.test.ts`

**Interfaces:**
- Produces:
  - `prefersReducedMotion(): boolean` (false when `matchMedia` is unavailable)
  - `type RevealPhase = 'back' | 'flip' | 'shown'`
  - `REVEAL_TIMING = { back: 250, flip: 600, celebrate: 1200 }`
  - `useReveal(rare: boolean, reducedMotion: boolean): { phase: RevealPhase; celebrate: boolean; skip(): void }` — any keydown on `window` during `back`/`flip` also skips

- [ ] **Step 1: Write failing tests** `src/screens/useReveal.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { REVEAL_TIMING, useReveal } from './useReveal'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('back → flip → shown on schedule; common editions do not celebrate', () => {
  const { result } = renderHook(() => useReveal(false, false))
  expect(result.current.phase).toBe('back')
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.back))
  expect(result.current.phase).toBe('flip')
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.flip))
  expect(result.current.phase).toBe('shown')
  expect(result.current.celebrate).toBe(false)
})

test('rare editions celebrate for a while after the flip', () => {
  const { result } = renderHook(() => useReveal(true, false))
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.back + REVEAL_TIMING.flip))
  expect(result.current.celebrate).toBe(true)
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.celebrate))
  expect(result.current.celebrate).toBe(false)
})

test('reduced motion starts shown with no celebration', () => {
  const { result } = renderHook(() => useReveal(true, true))
  expect(result.current.phase).toBe('shown')
  expect(result.current.celebrate).toBe(false)
})

test('skip jumps to shown, is idempotent, and still celebrates rare editions', () => {
  const { result } = renderHook(() => useReveal(true, false))
  act(() => result.current.skip())
  act(() => result.current.skip())
  expect(result.current.phase).toBe('shown')
  expect(result.current.celebrate).toBe(true)
  act(() => vi.advanceTimersByTime(REVEAL_TIMING.back + REVEAL_TIMING.flip))
  expect(result.current.phase).toBe('shown')
})

test('a keypress during the reveal skips it', () => {
  const { result } = renderHook(() => useReveal(false, false))
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
  })
  expect(result.current.phase).toBe('shown')
})

test('unmounting mid-reveal leaves no pending timers', () => {
  const { unmount } = renderHook(() => useReveal(true, false))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/screens/useReveal.test.ts` → Expected: FAIL, cannot resolve `./useReveal`.

- [ ] **Step 3: Implement `src/ui/motion.ts`**

```ts
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
```

- [ ] **Step 4: Implement `src/screens/useReveal.ts`** (all state changes happen in timer/event callbacks, never directly in an effect body)

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

export type RevealPhase = 'back' | 'flip' | 'shown'

export const REVEAL_TIMING = { back: 250, flip: 600, celebrate: 1200 } as const

export function useReveal(rare: boolean, reducedMotion: boolean) {
  const [phase, setPhase] = useState<RevealPhase>(reducedMotion ? 'shown' : 'back')
  const [celebrate, setCelebrate] = useState(false)
  const phaseRef = useRef(phase)

  const show = useCallback(() => {
    if (phaseRef.current === 'shown') return
    phaseRef.current = 'shown'
    setPhase('shown')
    if (rare && !reducedMotion) setCelebrate(true)
  }, [rare, reducedMotion])

  // Advance back → flip → shown.
  useEffect(() => {
    if (phase === 'shown') return
    const id = setTimeout(() => {
      if (phase === 'flip') return show()
      phaseRef.current = 'flip'
      setPhase('flip')
    }, REVEAL_TIMING[phase])
    return () => clearTimeout(id)
  }, [phase, show])

  // Any key skips while the card is still turning.
  useEffect(() => {
    if (phase === 'shown') return
    window.addEventListener('keydown', show)
    return () => window.removeEventListener('keydown', show)
  }, [phase, show])

  // End the rare-edition celebration.
  useEffect(() => {
    if (!celebrate) return
    const id = setTimeout(() => setCelebrate(false), REVEAL_TIMING.celebrate)
    return () => clearTimeout(id)
  }, [celebrate])

  return { phase, celebrate, skip: show }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/screens/useReveal.test.ts` → Expected: all 6 pass. Run `npm run lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/motion.ts src/screens/useReveal.ts src/screens/useReveal.test.ts
git commit -m "feat: add card reveal phase hook"
```

---

### Task 6: Editor reveal and live shimmer

**Files:**
- Create: `src/screens/ShimmerCard.tsx`, `src/screens/CardBackCanvas.tsx`
- Modify: `src/screens/Editor.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `useReveal`, `prefersReducedMotion`, `getEdition`, `SNAPSHOT_ANGLE`, `angleFor`, `driftAngle`, `composeStamp(…, opts)`, `cardBack`, `TiltCard`

- [ ] **Step 1: Create `src/screens/ShimmerCard.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { SNAPSHOT_ANGLE, angleFor, driftAngle } from '../editions/angle'
import type { Edition } from '../editions/types'
import type { PhotoSource } from '../photo/crop'
import { composeStamp } from '../render/composeStamp'
import type { Template } from '../templates/types'

interface Props {
  template: Template
  photo: PhotoSource
  values: Record<string, string>
  edition: Edition
  scale: number
  label: string
  /** Animate the shimmer (pointer-follow + idle drift). */
  live: boolean
}

export function ShimmerCard({ template, photo, values, edition, scale, label, live }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const pointer = useRef<number | null>(null)
  const animate = live && edition.hasEffect

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = (angle: number) => composeStamp(template, photo, values, scale, canvas, { edition, angle })
    if (!animate) {
      draw(SNAPSHOT_ANGLE)
      return
    }
    // requestAnimationFrame pauses on hidden tabs, so the drift stops there too.
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      draw(pointer.current ?? driftAngle(now - t0))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [template, photo, values, edition, scale, animate])

  return (
    <div
      onPointerMove={(e) => {
        pointer.current = angleFor(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
      }}
      onPointerLeave={() => {
        pointer.current = null
      }}
    >
      <canvas ref={ref} className="stamp-canvas" role="img" aria-label={label} />
    </div>
  )
}
```

- [ ] **Step 2: Create `src/screens/CardBackCanvas.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { cardBack } from '../render/cardBack'
import type { Template } from '../templates/types'

export function CardBackCanvas({ template, scale }: { template: Template; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) cardBack(template, scale, ref.current)
  }, [template, scale])
  return <canvas ref={ref} className="stamp-canvas" aria-hidden="true" />
}
```

- [ ] **Step 3: Update `src/screens/Editor.tsx`**

Imports — replace `import { StampCanvas } from './StampCanvas'` with:

```tsx
import { SNAPSHOT_ANGLE } from '../editions/angle'
import { getEdition } from '../editions/registry'
import { TiltCard } from '../ui/TiltCard'
import { prefersReducedMotion } from '../ui/motion'
import { CardBackCanvas } from './CardBackCanvas'
import { ShimmerCard } from './ShimmerCard'
import { useReveal } from './useReveal'
```

Inside `Editor`, after `const values = …`:

```tsx
  const edition = getEdition(useBooth((s) => s.edition))
  const [reducedMotion] = useState(prefersReducedMotion)
  const { phase, celebrate, skip } = useReveal(edition.rare, reducedMotion)
```

(These hooks must stay above the `if (!capture) return null` early return.)

Change `renderFull` to include the edition snapshot:

```tsx
  const renderFull = () =>
    composeStamp(template, capture, values, EXPORT_SCALE, undefined, { edition, angle: SNAPSHOT_ANGLE })
```

Replace the `<div className="preview-wrap">…</div>` block with:

```tsx
      <div className="reveal" data-phase={phase} onClick={phase === 'shown' ? undefined : skip}>
        <div className="reveal-card">
          <div className="reveal-face reveal-front">
            <TiltCard>
              <ShimmerCard
                template={template}
                photo={capture}
                values={values}
                edition={edition}
                scale={PREVIEW_SCALE}
                label={`Your ${edition.hasEffect ? `${edition.name.toLowerCase()} ` : ''}${template.name.toLowerCase()}`}
                live={phase === 'shown' && !reducedMotion}
              />
            </TiltCard>
          </div>
          <div className="reveal-face reveal-back">
            <CardBackCanvas template={template} scale={PREVIEW_SCALE} />
          </div>
        </div>
        {celebrate && (
          <>
            <div className="edition-banner" role="status">{edition.name.toUpperCase()}!</div>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="sparkle" style={{ '--a': `${i * 36}deg` } as CSSProperties} />
            ))}
          </>
        )}
      </div>
      {phase === 'shown' && edition.hasEffect && !celebrate && (
        <p className="edition-note">{edition.name} edition</p>
      )}
```

Change the React import line to `import { useState, type CSSProperties } from 'react'`.

- [ ] **Step 4: Styles** — in `src/index.css`, remove the now-unused `.pop-in` rule and its keyframes and its entry in the reduced-motion block, and add before `.print-only { display: none; }`:

```css
/* Card reveal */
.reveal { position: relative; perspective: 900px; width: min(100%, 520px); }
.reveal[data-phase='back'], .reveal[data-phase='flip'] { cursor: pointer; }
.reveal canvas { width: 100%; }
.reveal-card { position: relative; transform-style: preserve-3d; transition: transform 600ms cubic-bezier(.3, 1.4, .5, 1); }
.reveal[data-phase='back'] .reveal-card { transform: rotateY(180deg); }
.reveal-face { backface-visibility: hidden; }
.reveal-back { position: absolute; inset: 0; transform: rotateY(180deg); }

.edition-banner {
  position: absolute; left: 50%; top: 50%; translate: -50% -50%; pointer-events: none; white-space: nowrap;
  font: 700 clamp(28px, 7vw, 52px) var(--font); color: var(--gold);
  text-shadow: 4px 4px 0 var(--dark), -2px -2px 0 var(--red);
  animation: banner 1.2s ease-out forwards;
}
@keyframes banner {
  0% { transform: scale(.4) rotate(-8deg); opacity: 0; }
  15% { transform: scale(1.15) rotate(3deg); opacity: 1; }
  30% { transform: scale(1) rotate(0); }
  80% { opacity: 1; }
  100% { transform: translateY(-24px); opacity: 0; }
}
.sparkle {
  position: absolute; left: 50%; top: 50%; width: 10px; height: 10px; pointer-events: none;
  background: var(--gold); box-shadow: 0 0 0 3px var(--dark);
  animation: burst 900ms ease-out forwards;
}
@keyframes burst {
  from { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0) scale(1); opacity: 1; }
  to { transform: translate(-50%, -50%) rotate(var(--a)) translateY(-180px) scale(.3); opacity: 0; }
}
.edition-note { margin: 0; font-weight: 700; color: var(--gold); text-shadow: 2px 2px 0 var(--dark); }
```

and inside the existing `@media (prefers-reduced-motion: reduce)` block add:

```css
  .reveal-card { transition: none; }
  .edition-banner, .sparkle { animation: none; }
```

- [ ] **Step 5: Verify**

Run: `npm test && npx tsc -b && npm run lint` → Expected: all pass, lint clean.

In the browser (headless Chrome via CDP with fake camera, or by hand): set `localStorage['pixel-booth:operator'] = '{"weights":{"common":60,"foil":25,"holo":12,"poly":3},"forced":"holo"}'`, reload, capture a stamp. Expected:
1. Card back shows briefly, flips to the front; "HOLOGRAPHIC!" banner + sparkles; banner fades.
2. Rainbow shimmer on the frame only (photo area unchanged); moves with the pointer; drifts when idle; "★ HOLO" badge top-left.
3. Download PNG contains shimmer + badge; photo region visually identical to a Common capture.
4. Clicking during the back phase skips straight to the front.
5. Forced `common`: no banner, no badge, no shimmer note.
6. Phone width (375px): reveal fits, no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git add src/screens src/index.css
git commit -m "feat: reveal captures with a card flip and live edition shimmer"
```

---

### Task 7: Operator panel

**Files:**
- Create: `src/ui/taps.ts`, `src/ui/taps.test.ts`, `src/screens/OperatorPanel.tsx`, `src/screens/OperatorPanel.test.tsx`
- Modify: `src/App.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `useOperator`, `editions`
- Produces: `registerTap(times: readonly number[], now: number, count?: number, windowMs?: number): { times: number[]; triggered: boolean }`; `<OperatorPanel onClose />`; App opens it on 5 logo taps within 2 s or `Shift+Alt+O` (`event.code === 'KeyO'`)

- [ ] **Step 1: Write failing tests.** `src/ui/taps.test.ts`:

```ts
import { expect, test } from 'vitest'
import { registerTap } from './taps'

test('triggers on the 5th tap inside the window and resets', () => {
  let times: number[] = []
  for (const now of [0, 300, 600, 900]) {
    const r = registerTap(times, now)
    expect(r.triggered).toBe(false)
    times = r.times
  }
  const r = registerTap(times, 1200)
  expect(r).toEqual({ times: [], triggered: true })
})

test('taps older than the window do not count', () => {
  let times: number[] = []
  for (const now of [0, 500, 1000, 1500]) times = registerTap(times, now).times
  expect(registerTap(times, 2600).triggered).toBe(false)
})
```

`src/screens/OperatorPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import App from '../App'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useBooth.setState(useBooth.getInitialState(), true)
})

const logo = () => screen.getByRole('heading', { level: 1 })

test('five logo taps open the panel; Escape closes it', () => {
  render(<App />)
  for (let i = 0; i < 4; i++) fireEvent.click(logo())
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(logo())
  const dialog = screen.getByRole('dialog', { name: /operator settings/i })
  expect(document.activeElement).toBe(dialog)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('Shift+Alt+O opens the panel', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', key: 'Ø', shiftKey: true, altKey: true })
  expect(screen.getByRole('dialog')).toBeTruthy()
})

test('sliders, force select and reset update operator settings', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  fireEvent.change(screen.getByLabelText(/holographic/i), { target: { value: '40' } })
  expect(useOperator.getState().weights.holo).toBe(40)
  fireEvent.change(screen.getByLabelText(/force edition/i), { target: { value: 'poly' } })
  expect(useOperator.getState().forced).toBe('poly')
  fireEvent.click(screen.getByRole('button', { name: /reset/i }))
  expect(useOperator.getState()).toMatchObject({ forced: 'random', weights: { holo: 12 } })
})

test('all-zero weights show 100% common', () => {
  for (const id of ['common', 'foil', 'holo', 'poly']) useOperator.getState().setWeight(id, 0)
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  expect(screen.getByTestId('pct-common').textContent).toBe('100%')
  expect(screen.getByTestId('pct-poly').textContent).toBe('0%')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/taps.test.ts src/screens/OperatorPanel.test.tsx` → Expected: FAIL, missing `./taps`; panel tests fail (no dialog).

- [ ] **Step 3: Implement `src/ui/taps.ts`**

```ts
/** Records a tap; triggers when `count` taps land within `windowMs`. */
export function registerTap(times: readonly number[], now: number, count = 5, windowMs = 2000) {
  const recent = [...times.filter((t) => now - t < windowMs), now]
  return recent.length >= count ? { times: [], triggered: true } : { times: recent, triggered: false }
}
```

- [ ] **Step 4: Implement `src/screens/OperatorPanel.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { editions } from '../editions/registry'
import { useOperator } from '../store/operator'

export function OperatorPanel({ onClose }: { onClose: () => void }) {
  const weights = useOperator((s) => s.weights)
  const forced = useOperator((s) => s.forced)
  const { setWeight, setForced, reset } = useOperator.getState()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  const total = editions.reduce((sum, e) => sum + Math.max(0, weights[e.id] ?? 0), 0)
  const pct = (id: string) =>
    total > 0 ? Math.round((Math.max(0, weights[id] ?? 0) / total) * 100) : id === 'common' ? 100 : 0

  return (
    <div className="operator-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="operator-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operator-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="operator-title">Operator settings</h2>
        {editions.map((e) => (
          <label key={e.id} className="operator-row">
            <span>{e.name}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[e.id] ?? 0}
              onChange={(ev) => setWeight(e.id, Number(ev.target.value))}
            />
            <output data-testid={`pct-${e.id}`}>{pct(e.id)}%</output>
          </label>
        ))}
        <label className="operator-row">
          <span>Force edition</span>
          <select value={forced} onChange={(ev) => setForced(ev.target.value)}>
            <option value="random">Random</option>
            {editions.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <button className="btn" onClick={reset}>Reset to defaults</button>
          <button className="btn gold" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update `src/App.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { Booth } from './screens/Booth'
import { Editor } from './screens/Editor'
import { OperatorPanel } from './screens/OperatorPanel'
import { TemplatePicker } from './screens/TemplatePicker'
import { useBooth } from './store/booth'
import { SwirlBackground } from './ui/SwirlBackground'
import { registerTap } from './ui/taps'

export default function App() {
  const screen = useBooth((s) => s.screen)
  const [panelOpen, setPanelOpen] = useState(false)
  const taps = useRef<number[]>([])
  const closePanel = useCallback(() => setPanelOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.code === 'KeyO') setPanelOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onLogoTap() {
    const r = registerTap(taps.current, performance.now())
    taps.current = r.times
    if (r.triggered) setPanelOpen(true)
  }

  return (
    <>
      <SwirlBackground />
      <main className="app">
        <h1 className="logo" onClick={onLogoTap}>PIXEL BOOTH</h1>
        {screen === 'picker' && <TemplatePicker />}
        {screen === 'booth' && <Booth />}
        {screen === 'editor' && <Editor />}
        {panelOpen && <OperatorPanel onClose={closePanel} />}
      </main>
    </>
  )
}
```

(The panel lives inside `.app`, so the existing print rule hides it.)

- [ ] **Step 6: Styles** — add to `src/index.css` before `.print-only { display: none; }`:

```css
/* Operator panel */
.logo { user-select: none; -webkit-tap-highlight-color: transparent; }
.operator-backdrop {
  position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 16px;
  background: rgb(0 0 0 / 0.55);
}
.operator-panel {
  display: grid; gap: 14px; width: min(100%, 440px); padding: 20px;
  background: var(--panel); border: 3px solid var(--dark); border-radius: 8px; box-shadow: 0 6px 0 var(--dark);
}
.operator-panel:focus { outline: none; }
.operator-row { display: grid; grid-template-columns: 7.5em 1fr 3.5em; gap: 10px; align-items: center; }
.operator-row output { text-align: right; font-weight: 700; }
.operator-row select { grid-column: 2 / 4; font: 700 16px var(--font); padding: 6px; background: var(--dark); color: var(--ink); border: 3px solid var(--dark); border-radius: 6px; }
.operator-row input[type='range'] { accent-color: var(--gold); width: 100%; }
```

- [ ] **Step 7: Run tests**

Run: `npm test && npx tsc -b && npm run lint` → Expected: all pass, lint clean.

- [ ] **Step 8: Verify in browser** — tap the logo 5 times → panel; set Force = Polychrome; Close; reload → setting kept; capture → Polychrome reveal. At 375 px wide the panel fits without horizontal scroll.

- [ ] **Step 9: Commit**

```bash
git add src/ui/taps.ts src/ui/taps.test.ts src/screens/OperatorPanel.tsx src/screens/OperatorPanel.test.tsx src/App.tsx src/index.css
git commit -m "feat: add hidden operator panel for edition odds"
```

---

### Task 8: README and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a section to `README.md`** after "## Deploy":

```markdown
## Card editions

Every capture rolls an edition — Common, Foil, Holographic, or Polychrome — that adds a pixel shimmer to the frame (never the photo) and a badge. Rare editions get a reveal banner.

**Operator settings:** tap the PIXEL BOOTH logo 5 times (or press Shift+Alt+O) to change the odds or force an edition, e.g. all Holographic for a VIP table. Settings are saved in this browser only.

To add an edition, create `src/editions/<name>.ts` exporting an `Edition` and add it to `src/editions/registry.ts`.
```

- [ ] **Step 2: Full verification**

Run: `npm test && npm run build && npm run lint && git status` → all pass, only README modified.

Run `npm run preview` and repeat Task 6 Step 5 items 1–3 and Task 7 Step 8 against the production build.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document card editions and operator settings"
```
