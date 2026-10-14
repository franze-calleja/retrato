# Instant Camera Booth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the booth's card-frame preview with a pixel-art instant camera (front by default, Front/Back toggle, side/rear screens showing the exact card crop), and turn each capture into an instant print that ejects, develops and hands off to the editor or pack opening.

**Architecture:** Pure canvas art in `src/camera/cameraArt.ts` (front/back, exported screen/shutter/flash rects). A pure `drawLiveCrop` renders the live feed cropped and shape-clipped to the template's photo window. `CameraStage` lays out the flipping camera, side screen and rear screen. A `usePrintSequence` hook drives `InstantPrint` (`flash → eject → develop → handoff → done`); Booth freezes the captured frame, shows the print, then calls the existing `keep(photo)`.

**Tech Stack:** Vite 8, React 19.2, TypeScript ~6.0, Zustand 5, Vitest 4.1 (jsdom, vitest-canvas-mock), @testing-library/react 16.

**Spec:** `docs/superpowers/specs/2026-10-14-instant-camera-design.md`

## Global Constraints

- No new dependencies; no upgrades.
- No real brand names, logos or product wording in art or copy; the only text on the camera is "PIXEL BOOTH".
- `CAMERA_ART = { w: 128, h: 88 }`, drop shadow 3 → `CAMERA_SIZE = { w: 131, h: 91 }`; art drawn with existing `draw.ts`/`shapes.ts`/`pixelFont.ts` helpers.
- `PRINT_TIMING = { flash: 150, eject: 900, develop: 1200, handoff: 450 }`.
- Photo stays smooth (never `image-rendering: pixelated` on photo canvases).
- Reduced motion: no flip transition, no print sequence (Booth calls `keep` immediately), no flash.
- Key filter for skipping = the pack opening's (`isAdvanceKey`), moved to `src/ui/keys.ts` and shared.
- Copy: "Show back" / "Show front", "Skip to your card" (single) / "Skip to your pack" (pack).
- Conventional Commits; no AI attribution. Before each commit: `npx tsc -b && npm run lint && npx vitest run`.

## Review Focus

1. `keep` (and so `setCapture`/photo counter) must run exactly once per capture — not on skip + timer, not after unmount. Test in Task 5.
2. The frozen frame must be the moment of capture (the video keeps moving during the print). Test in Task 5 (freeze copies the source once).
3. Only one live-preview canvas has the accessible "live preview" name at a time (front side screen vs rear screen). Test in Task 4.
4. Uploads during/after leaving the booth: no print and no capture after unmount. Test in Task 5.
5. Phone width: side screen overlaps the camera instead of widening the page. Manual in Task 6.

---

### Task 1: Camera art

**Files:**
- Modify: `src/templates/colors.ts`
- Create: `src/camera/cameraArt.ts`
- Test: `src/camera/cameraArt.test.ts`

**Interfaces:**
- Produces: colours `SILVER, SILVER_LIGHT, SILVER_DARK, LEATHER, LEATHER_DARK, COPPER, COPPER_DARK, LENS_DARK`; `CAMERA_ART`, `CAMERA_SIZE`, `SHUTTER`, `FLASH`, `REAR_SCREEN` (all `Rect` in art pixels); `type CameraSide = 'front' | 'back'`; `drawCameraFront(ctx)`, `drawCameraBack(ctx)`; `cameraArt(side, scale, target?) → HTMLCanvasElement`.

- [ ] **Step 1: Failing tests** — `src/camera/cameraArt.test.ts`

```ts
import { expect, test, vi } from 'vitest'

const texts = vi.hoisted(() => [] as string[])
vi.mock('../templates/pixelFont', async (orig) => {
  const mod = await orig<typeof import('../templates/pixelFont')>()
  return {
    ...mod,
    drawText: (...a: Parameters<typeof mod.drawText>) => (texts.push(a[1]), mod.drawText(...a)),
    drawTextCentered: (...a: Parameters<typeof mod.drawTextCentered>) => (texts.push(a[1]), mod.drawTextCentered(...a)),
  }
})
const { CAMERA_ART, CAMERA_SIZE, FLASH, REAR_SCREEN, SHUTTER, cameraArt } = await import('./cameraArt')

const inside = (r: { x: number; y: number; w: number; h: number }) =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= CAMERA_ART.w && r.y + r.h <= CAMERA_ART.h

test('art is the camera size times the scale, for both sides', () => {
  for (const side of ['front', 'back'] as const) {
    const c = cameraArt(side, 3)
    expect([c.width, c.height]).toEqual([CAMERA_SIZE.w * 3, CAMERA_SIZE.h * 3])
  }
})

test('draws into a given canvas', () => {
  const target = document.createElement('canvas')
  expect(cameraArt('front', 2, target)).toBe(target)
})

test('shutter, flash and rear screen sit inside the body', () => {
  for (const r of [SHUTTER, FLASH, REAR_SCREEN]) expect(inside(r)).toBe(true)
})

test('the only lettering on the camera is PIXEL BOOTH', () => {
  texts.length = 0
  cameraArt('front', 1, document.createElement('canvas'))
  cameraArt('back', 1, document.createElement('canvas'))
  expect(new Set(texts.filter(Boolean))).toEqual(new Set(['PIXEL BOOTH']))
})
```

- [ ] **Step 2: Run** `npx vitest run src/camera/cameraArt.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

Append to `src/templates/colors.ts`:

```ts
export const SILVER: Color = [196, 200, 208]
export const SILVER_LIGHT: Color = [234, 236, 242]
export const SILVER_DARK: Color = [126, 130, 146]
export const LEATHER: Color = [152, 86, 48]
export const LEATHER_DARK: Color = [110, 58, 32]
export const COPPER: Color = [196, 116, 64]
export const COPPER_DARK: Color = [122, 64, 32]
export const LENS_DARK: Color = [44, 46, 62]
```

`src/camera/cameraArt.ts`:

```ts
import {
  COPPER, COPPER_DARK, CREAM, LEATHER, LEATHER_DARK, LENS_DARK, NAVY_DARK, OUTLINE, RED, SHADOW,
  SILVER, SILVER_DARK, SILVER_LIGHT,
} from '../templates/colors'
import { fill, panel, withDropShadow } from '../templates/draw'
import { drawText } from '../templates/pixelFont'
import { fillShape, grow } from '../templates/shapes'
import type { Rect } from '../templates/types'

// Original pixel camera inspired by retro hybrid instant cameras: no real brand marks.

export type CameraSide = 'front' | 'back'

export const CAMERA_ART = { w: 128, h: 88 }
const SHADOW_OFFSET = 3
export const CAMERA_SIZE = { w: CAMERA_ART.w + SHADOW_OFFSET, h: CAMERA_ART.h + SHADOW_OFFSET }

export const SHUTTER: Rect = { x: 77, y: 3, w: 15, h: 15 }
export const FLASH: Rect = { x: 98, y: 4, w: 26, h: 14 }
export const REAR_SCREEN: Rect = { x: 10, y: 12, w: 70, h: 56 }
const LEATHER_RECT: Rect = { x: 6, y: 22, w: 116, h: 58 }
const LENS: Rect = { x: 40, y: 27, w: 48, h: 48 }

const hash = (x: number, y: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return n - Math.floor(n)
}

function body(ctx: CanvasRenderingContext2D) {
  const { w, h } = CAMERA_ART
  panel(ctx, OUTLINE, 0, 0, w, h, 4)
  panel(ctx, SILVER, 1, 1, w - 2, h - 2, 3)
  fill(ctx, SILVER_LIGHT, 4, 2, w - 8, 1)
  fill(ctx, SILVER_DARK, 4, h - 3, w - 8, 1)
  // Print slot along the top edge.
  fill(ctx, OUTLINE, 34, 2, 60, 1)
}

function leather(ctx: CanvasRenderingContext2D, r: Rect) {
  panel(ctx, OUTLINE, r.x, r.y, r.w, r.h, 2)
  panel(ctx, LEATHER, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 1)
  for (let y = r.y + 2; y < r.y + r.h - 2; y++)
    for (let x = r.x + 2; x < r.x + r.w - 2; x++) if (hash(x, y) < 0.18) fill(ctx, LEATHER_DARK, x, y, 1, 1)
}

function ring(ctx: CanvasRenderingContext2D, r: Rect, colors: Parameters<typeof fill>[1][]) {
  colors.forEach((c, i) => fillShape(ctx, c, grow(r, -i), 'circle'))
}

export function drawCameraFront(ctx: CanvasRenderingContext2D) {
  body(ctx)
  drawText(ctx, 'PIXEL BOOTH', 8, 8, OUTLINE)
  // Viewfinder window.
  panel(ctx, OUTLINE, 54, 5, 16, 12, 1)
  fill(ctx, SILVER_LIGHT, 55, 6, 14, 10)
  fill(ctx, SILVER_DARK, 55, 15, 14, 1)
  // Shutter button.
  ring(ctx, SHUTTER, [OUTLINE, SILVER_DARK, SILVER, SILVER, SILVER_LIGHT])
  fill(ctx, CREAM, SHUTTER.x + 5, SHUTTER.y + 4, 2, 1)
  // Flash with its red light.
  panel(ctx, OUTLINE, FLASH.x, FLASH.y, FLASH.w, FLASH.h, 2)
  panel(ctx, NAVY_DARK, FLASH.x + 1, FLASH.y + 1, FLASH.w - 2, FLASH.h - 2, 1)
  fill(ctx, RED, FLASH.x + 3, FLASH.y + 3, 3, 8)
  fill(ctx, CREAM, FLASH.x + 8, FLASH.y + 2, 16, 10)
  for (let x = FLASH.x + 10; x < FLASH.x + 23; x += 3) fill(ctx, SILVER_LIGHT, x, FLASH.y + 3, 1, 8)
  leather(ctx, LEATHER_RECT)
  // Lens: silver ring, dark barrel, glass with a highlight.
  ring(ctx, LENS, [OUTLINE, SILVER_LIGHT, SILVER, SILVER, SILVER_DARK, OUTLINE, LENS_DARK, LENS_DARK, LENS_DARK])
  ring(ctx, grow(LENS, -11), [OUTLINE, NAVY_DARK, NAVY_DARK, LENS_DARK])
  ring(ctx, grow(LENS, -17), [OUTLINE, NAVY_DARK])
  fill(ctx, CREAM, LENS.x + 17, LENS.y + 16, 2, 2)
  fill(ctx, SILVER_LIGHT, LENS.x + 20, LENS.y + 15, 1, 1)
  // Copper power dial.
  ring(ctx, { x: 9, y: 63, w: 15, h: 15 }, [OUTLINE, COPPER_DARK, COPPER, COPPER])
  fill(ctx, COPPER_DARK, 16, 66, 1, 6)
}

export function drawCameraBack(ctx: CanvasRenderingContext2D) {
  body(ctx)
  const s = REAR_SCREEN
  panel(ctx, OUTLINE, s.x - 2, s.y - 2, s.w + 4, s.h + 4, 2)
  fill(ctx, NAVY_DARK, s.x, s.y, s.w, s.h)
  // Two dials and a 4-way pad.
  ring(ctx, { x: 92, y: 14, w: 17, h: 17 }, [OUTLINE, SILVER_DARK, SILVER, SILVER_LIGHT])
  ring(ctx, { x: 92, y: 36, w: 17, h: 17 }, [OUTLINE, SILVER_DARK, SILVER, SILVER_LIGHT])
  fill(ctx, OUTLINE, 99, 58, 3, 13)
  fill(ctx, OUTLINE, 94, 63, 13, 3)
  fill(ctx, SILVER_DARK, 100, 59, 1, 11)
  fill(ctx, SILVER_DARK, 95, 64, 11, 1)
  leather(ctx, { x: 6, y: 74, w: 116, h: 10 })
}

const cache = new Map<CameraSide, HTMLCanvasElement>()

function art(side: CameraSide) {
  let c = cache.get(side)
  if (!c) {
    c = document.createElement('canvas')
    c.width = CAMERA_SIZE.w
    c.height = CAMERA_SIZE.h
    withDropShadow(c.getContext('2d')!, CAMERA_ART.w, CAMERA_ART.h, SHADOW_OFFSET, SHADOW, side === 'front' ? drawCameraFront : drawCameraBack)
    cache.set(side, c)
  }
  return c
}

export function cameraArt(side: CameraSide, scale: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const out = target ?? document.createElement('canvas')
  out.width = CAMERA_SIZE.w * scale
  out.height = CAMERA_SIZE.h * scale
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(art(side), 0, 0, out.width, out.height)
  return out
}
```

Note: the "only lettering" test calls `cameraArt` with fresh canvases; since `art(side)` caches, the test must run before any other caller caches the art in that module instance, or clear the cache. Export `__resetCameraArtCache = () => cache.clear()` for tests if the test fails because of caching, and call it at the start of that test.

- [ ] **Step 4: Run** — Expected: PASS (4 tests).
- [ ] **Step 5: Commit** `feat: add pixel instant camera art (front and back)`

---

### Task 2: Live crop

**Files:**
- Create: `src/camera/liveCrop.ts`
- Test: `src/camera/liveCrop.test.ts`

**Interfaces:**
- Consumes: `drawCover`, `PhotoSource` (`src/photo/crop.ts`), `shapeSpans` (`src/templates/shapes.ts`), `Template`.
- Produces: `screenSize(template: Pick<Template, 'photoRect'>, width: number): { w: number; h: number }` (canvas size with the window's aspect at the given width); `drawLiveCrop(ctx, photo: PhotoSource, template: Pick<Template, 'photoRect' | 'photoShape'>, w: number, h: number): void`.

- [ ] **Step 1: Failing tests** — `src/camera/liveCrop.test.ts`

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { PACKS } from '../packs/catalog'
import { packViewfinder } from '../packs/viewfinder'
import { templates } from '../templates/registry'
import { drawLiveCrop, screenSize } from './liveCrop'

afterEach(() => vi.restoreAllMocks())

const all = [...templates, ...PACKS.map(packViewfinder)]
const photo = (mirror = false) => ({ source: document.createElement('canvas'), w: 1280, h: 720, mirror })

test.each(all.map((t) => [t.id, t] as const))('%s screen has the photo window aspect', (_id, t) => {
  const { w, h } = screenSize(t, 240)
  expect(w).toBe(240)
  expect(w / h).toBeCloseTo(t.photoRect.w / t.photoRect.h, 1)
})

test.each(all.map((t) => [t.id, t] as const))('%s crop fills the screen; shaped windows clip', (_id, t) => {
  const canvas = document.createElement('canvas')
  const { w, h } = screenSize(t, 240)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const draw = vi.spyOn(ctx, 'drawImage')
  const clip = vi.spyOn(ctx, 'clip')
  drawLiveCrop(ctx, photo(), t, w, h)
  expect(draw.mock.calls.at(-1)!.slice(5)).toEqual([0, 0, w, h])
  expect(clip).toHaveBeenCalledTimes((t.photoShape ?? 'rect') === 'rect' ? 0 : 1)
})

test('camera sources are mirrored like the booth preview', () => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const scale = vi.spyOn(ctx, 'scale')
  drawLiveCrop(ctx, photo(true), templates[0], 100, 120)
  expect(scale).toHaveBeenCalledWith(-1, 1)
})
```

- [ ] **Step 2: Run** — Expected: FAIL (module missing).

- [ ] **Step 3: Implement** — `src/camera/liveCrop.ts`

```ts
import { drawCover, type PhotoSource } from '../photo/crop'
import { shapeSpans } from '../templates/shapes'
import type { Template } from '../templates/types'

type Window = Pick<Template, 'photoRect' | 'photoShape'>

/** Canvas size for a camera screen showing a photo window: `width` wide, the window's aspect. */
export function screenSize(t: Pick<Template, 'photoRect'>, width: number) {
  return { w: width, h: Math.max(1, Math.round((width * t.photoRect.h) / t.photoRect.w)) }
}

/** The live feed cropped exactly as it will land on the card, clipped to arch/circle windows. */
export function drawLiveCrop(ctx: CanvasRenderingContext2D, photo: PhotoSource, t: Window, w: number, h: number) {
  ctx.clearRect(0, 0, w, h)
  const shape = t.photoShape ?? 'rect'
  if (shape === 'rect') return drawCover(ctx, photo, 0, 0, w, h)
  const kx = w / t.photoRect.w
  const ky = h / t.photoRect.h
  ctx.save()
  ctx.beginPath()
  for (const [y, x0, x1] of shapeSpans(t.photoRect.w, t.photoRect.h, shape)) ctx.rect(x0 * kx, y * ky, (x1 - x0) * kx, ky)
  ctx.clip()
  drawCover(ctx, photo, 0, 0, w, h)
  ctx.restore()
}
```

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: draw the live feed cropped to the card's photo window`

---

### Task 3: Shared key filter and print sequence hook

**Files:**
- Create: `src/ui/keys.ts`, `src/screens/usePrintSequence.ts`
- Modify: `src/screens/usePackOpen.ts` (import `isAdvanceKey` from `../ui/keys` instead of defining it)
- Test: `src/screens/usePrintSequence.test.ts`

**Interfaces:**
- Produces: `isAdvanceKey(e: KeyboardEvent): boolean` (moved verbatim); `type PrintPhase = 'flash' | 'eject' | 'develop' | 'handoff' | 'done'`; `PRINT_TIMING`; `usePrintSequence(reducedMotion: boolean): { phase: PrintPhase; skip(): void }` — starts at `flash` on mount (or `done` with reduced motion).

- [ ] **Step 1: Failing tests** — `src/screens/usePrintSequence.test.ts`

```ts
import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PRINT_TIMING, usePrintSequence } from './usePrintSequence'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
const step = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

test('walks flash → eject → develop → handoff → done', () => {
  const { result } = renderHook(() => usePrintSequence(false))
  expect(result.current.phase).toBe('flash')
  step(PRINT_TIMING.flash)
  expect(result.current.phase).toBe('eject')
  step(PRINT_TIMING.eject)
  expect(result.current.phase).toBe('develop')
  step(PRINT_TIMING.develop)
  expect(result.current.phase).toBe('handoff')
  step(PRINT_TIMING.handoff)
  expect(result.current.phase).toBe('done')
})

test.each(['flash', 'eject', 'develop', 'handoff'] as const)('skip from %s → done', (from) => {
  const { result } = renderHook(() => usePrintSequence(false))
  const order = ['flash', 'eject', 'develop', 'handoff'] as const
  for (const p of order.slice(0, order.indexOf(from))) step(PRINT_TIMING[p])
  expect(result.current.phase).toBe(from)
  act(() => result.current.skip())
  expect(result.current.phase).toBe('done')
})

test('a deliberate key skips; Tab and held keys do not', () => {
  const { result } = renderHook(() => usePrintSequence(false))
  fireEvent.keyDown(window, { key: 'Tab' })
  fireEvent.keyDown(window, { key: 'x', repeat: true })
  expect(result.current.phase).toBe('flash')
  fireEvent.keyDown(window, { key: 'x' })
  expect(result.current.phase).toBe('done')
})

test('reduced motion is done immediately', () => {
  const { result } = renderHook(() => usePrintSequence(true))
  expect(result.current.phase).toBe('done')
})

test('unmount clears timers', () => {
  const { unmount } = renderHook(() => usePrintSequence(false))
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
```

- [ ] **Step 2: Run** — Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`src/ui/keys.ts` — move `IGNORED_KEYS` and `isAdvanceKey` from `src/screens/usePackOpen.ts` verbatim (export both); in `usePackOpen.ts` delete them and `import { isAdvanceKey } from '../ui/keys'`.

`src/screens/usePrintSequence.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { isAdvanceKey } from '../ui/keys'

export type PrintPhase = 'flash' | 'eject' | 'develop' | 'handoff' | 'done'

export const PRINT_TIMING = { flash: 150, eject: 900, develop: 1200, handoff: 450 } as const

const NEXT: Record<Exclude<PrintPhase, 'done'>, PrintPhase> = { flash: 'eject', eject: 'develop', develop: 'handoff', handoff: 'done' }

/** Instant print: flash → eject → develop → handoff → done. Reduced motion is done at once. */
export function usePrintSequence(reducedMotion: boolean) {
  const [phase, setPhase] = useState<PrintPhase>(reducedMotion ? 'done' : 'flash')
  const skip = useCallback(() => setPhase('done'), [])

  useEffect(() => {
    if (phase === 'done') return
    const id = setTimeout(() => setPhase(NEXT[phase]), PRINT_TIMING[phase])
    return () => clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase === 'done') return
    const onKey = (e: KeyboardEvent) => {
      if (isAdvanceKey(e)) skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, skip])

  return { phase, skip }
}
```

- [ ] **Step 4: Run** `npx vitest run src/screens/usePrintSequence.test.ts src/screens/usePackOpen.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: add instant print sequence hook; share the deliberate-key filter`

---

### Task 4: Camera stage on the booth screen

**Files:**
- Modify: `src/store/booth.ts`, `src/screens/Booth.tsx`, `src/index.css`
- Create: `src/screens/CameraStage.tsx`
- Test: `src/store/booth.test.ts`, `src/screens/Booth.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`cameraArt`, `CAMERA_SIZE`, `REAR_SCREEN`, `SHUTTER`, `FLASH`, `CameraSide`), Task 2 (`screenSize`, `drawLiveCrop`).
- Produces: booth store `cameraSide: CameraSide` (default `'front'`, untouched by `cleared`, retake, goToPicker) and `setCameraSide(side)`; `CameraStage({ side, template, title, count, onShutter, shutterEnabled, screenRef, flashing })` where `screenRef: (canvas: HTMLCanvasElement | null) => void` receives the visible screen canvas.

- [ ] **Step 1: Failing tests**

`src/store/booth.test.ts` (inside the describe):

```ts
  test('camera side defaults to front and survives retake and change card', () => {
    expect(s().cameraSide).toBe('front')
    s().setCameraSide('back')
    s().selectTemplate('stamp')
    s().setCapture(photo())
    s().retake()
    s().goToPicker()
    expect(s().cameraSide).toBe('back')
  })
```

`src/screens/Booth.test.tsx` (append; reset store at the end of each new test):

```tsx
test('the booth shows the camera front with a side screen named after the card', () => {
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'tarot' }, true)
  render(<Booth />)
  expect(document.querySelector('.camera-flip')!.getAttribute('data-side')).toBe('front')
  expect(screen.getByRole('img', { name: /tarot card live preview/i }).closest('.side-screen')).not.toBeNull()
  expect(screen.getByText('Tarot Card', { selector: '.side-screen *' })).toBeTruthy()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('Show back turns the camera; only the rear screen is the live preview then', () => {
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth' }, true)
  render(<Booth />)
  const toggle = screen.getByRole('button', { name: /show back/i })
  fireEvent.click(toggle)
  expect(useBooth.getState().cameraSide).toBe('back')
  expect(document.querySelector('.camera-flip')!.getAttribute('data-side')).toBe('back')
  expect(screen.getByRole('button', { name: /show front/i }).getAttribute('aria-pressed')).toBe('true')
  const previews = screen.getAllByRole('img', { name: /live preview/i })
  expect(previews).toHaveLength(1)
  expect(previews[0].closest('.rear-screen')).not.toBeNull()
  useBooth.setState(useBooth.getInitialState(), true)
})
```

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement**

`src/store/booth.ts`: import `type CameraSide` from `../camera/cameraArt`; add to state `cameraSide: CameraSide` and `setCameraSide(side: CameraSide): void`; initial `cameraSide: 'front'`; action `setCameraSide: (cameraSide) => set({ cameraSide })`. (`cleared` does not include it.)

`src/screens/CameraStage.tsx`:

```tsx
import { useEffect, useRef, type CSSProperties } from 'react'
import { CAMERA_SIZE, FLASH, REAR_SCREEN, SHUTTER, cameraArt, type CameraSide } from '../camera/cameraArt'
import { screenSize } from '../camera/liveCrop'
import type { Rect, Template } from '../templates/types'
import { TiltCard } from '../ui/TiltCard'

const ART_SCALE = 4
const SCREEN_W = 240
const pct = (r: Rect) => ({
  left: `${(r.x / CAMERA_SIZE.w) * 100}%`,
  top: `${(r.y / CAMERA_SIZE.h) * 100}%`,
  width: `${(r.w / CAMERA_SIZE.w) * 100}%`,
  height: `${(r.h / CAMERA_SIZE.h) * 100}%`,
})

interface Props {
  side: CameraSide
  template: Template
  title: string
  count: number | null
  shutterEnabled: boolean
  onShutter: () => void
  /** Receives the canvas of the screen currently facing the guest. */
  screenRef: (canvas: HTMLCanvasElement | null) => void
  flashing: boolean
  children?: React.ReactNode
}

function Art({ side }: { side: CameraSide }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) cameraArt(side, ART_SCALE, ref.current)
  }, [side])
  return <canvas ref={ref} className="camera-art" aria-hidden="true" />
}

export function CameraStage({ side, template, title, count, shutterEnabled, onShutter, screenRef, flashing, children }: Props) {
  const size = screenSize(template, SCREEN_W)
  const countdown = count !== null && count > 0 && (
    <div key={count} className="countdown" aria-hidden="true">{count}</div>
  )
  const label = `${template.name} live preview`
  return (
    <div className={`camera-stage ${side}`}>
      <div className="camera-holder">
        {children}
        <TiltCard>
          <div className="camera-flip" data-side={side}>
            <div className="camera-face camera-front" aria-hidden={side !== 'front'}>
              <Art side="front" />
              <span className={`camera-flash ${flashing ? 'on' : ''}`} style={pct(FLASH)} aria-hidden="true" />
              <button
                className="shutter-hit"
                style={pct(SHUTTER)}
                tabIndex={-1}
                aria-hidden="true"
                disabled={!shutterEnabled}
                onClick={onShutter}
              />
            </div>
            <div className="camera-face camera-back" aria-hidden={side !== 'back'}>
              <Art side="back" />
              <div className="rear-screen" style={pct(REAR_SCREEN)}>
                <canvas
                  ref={side === 'back' ? screenRef : undefined}
                  width={size.w}
                  height={size.h}
                  className="stamp-canvas"
                  role={side === 'back' ? 'img' : undefined}
                  aria-label={side === 'back' ? label : undefined}
                />
                {side === 'back' && countdown}
              </div>
            </div>
          </div>
        </TiltCard>
      </div>
      {side === 'front' && (
        <div className="side-screen" style={{ '--aspect': `${size.w} / ${size.h}` } as CSSProperties}>
          <span className="hinge" aria-hidden="true" />
          <div className="side-screen-glass">
            <canvas ref={screenRef} width={size.w} height={size.h} className="stamp-canvas" role="img" aria-label={label} />
            {countdown}
          </div>
          <span className="side-screen-name">{title}</span>
        </div>
      )}
    </div>
  )
}
```

(Import `type ReactNode` from react instead of `React.ReactNode` if lint/tsc requires.)

`src/screens/Booth.tsx`:
- Remove `composeStamp`/`PREVIEW_SCALE` imports and `canvasRef`; add `const side = useBooth((s) => s.cameraSide)`, `const screenCanvas = useRef<HTMLCanvasElement | null>(null)`, `const setScreen = useCallback((c: HTMLCanvasElement | null) => { screenCanvas.current = c }, [])`.
- Idle preview effect: `if (status === 'live') return; const c = screenCanvas.current; if (c) drawLiveCrop(c.getContext('2d')!, placeholderPhoto(template), template, c.width, c.height)`; deps `[status, template, side]`.
- Live loop: in `tick`, `const c = screenCanvas.current; if (photo && c) drawLiveCrop(c.getContext('2d')!, photo, template, c.width, c.height)`; deps `[status, template, liveSource]`.
- Replace the `.preview-wrap` block with:

```tsx
      <CameraStage
        side={side}
        template={template}
        title={template.name}
        count={count}
        shutterEnabled={status === 'live' && count === null}
        onShutter={() => setCount(3)}
        screenRef={setScreen}
        flashing={false}
      />
```

  keeping the persistent visually-hidden countdown live region right after it.
- In the button row, before Back, add:

```tsx
        <button
          className="btn"
          aria-pressed={side === 'back'}
          onClick={() => useBooth.getState().setCameraSide(side === 'front' ? 'back' : 'front')}
        >
          {side === 'front' ? 'Show back' : 'Show front'}
        </button>
```

`src/index.css` — replace the `.preview-wrap` rules (keep `.countdown`, now positioned inside screens) with:

```css
.camera-stage { display: flex; align-items: center; justify-content: center; gap: 14px; width: min(100%, 760px); }
.camera-holder { position: relative; flex: 1 1 auto; max-width: 524px; min-width: 0; }
.camera-flip { position: relative; transform-style: preserve-3d; transition: transform 500ms cubic-bezier(.3, 1.3, .5, 1); }
.camera-flip[data-side='back'] { transform: rotateY(180deg); }
.camera-face { position: relative; backface-visibility: hidden; }
.camera-back { position: absolute; inset: 0; transform: rotateY(180deg); }
.camera-art { display: block; width: 100%; height: auto; }
.camera-flash { position: absolute; background: #fff; opacity: 0; pointer-events: none; border-radius: 4px; }
.camera-flash.on { animation: camera-flash 300ms ease-out; }
@keyframes camera-flash { 0% { opacity: 1; box-shadow: 0 0 40px 20px #fff; } 100% { opacity: 0; } }
.shutter-hit { position: absolute; background: none; border: 0; padding: 0; cursor: pointer; border-radius: 50%; }
.shutter-hit:disabled { cursor: default; }
.rear-screen { position: absolute; display: grid; place-items: center; overflow: hidden; }
.rear-screen canvas { max-width: 100%; max-height: 100%; width: auto; height: 100%; }
.side-screen { position: relative; flex: 0 0 150px; display: grid; gap: 6px; justify-items: center; }
.side-screen-glass {
  position: relative; width: 100%; aspect-ratio: var(--aspect); background: #10121c;
  border: 6px solid #2a2c3c; border-radius: 6px; box-shadow: 0 4px 0 var(--dark), inset 0 0 0 2px #000;
}
.side-screen-glass canvas { display: block; width: 100%; height: 100%; }
.side-screen-name { font-size: 15px; font-weight: 700; text-shadow: 2px 2px 0 var(--dark); text-align: center; }
.hinge { position: absolute; left: -14px; top: 30%; width: 14px; height: 24px; background: #8a8ea0; border: 3px solid var(--dark); border-radius: 3px; }
.side-screen .countdown, .rear-screen .countdown { font-size: 64px; }
@media (max-width: 559px) {
  .camera-stage { position: relative; display: block; }
  .camera-stage .side-screen { position: absolute; right: 2%; bottom: -6%; width: 34%; z-index: 2; }
  .camera-stage .hinge { display: none; }
}
```

and in the reduced-motion block: `.camera-flip { transition: none; }` and `.camera-flash.on { animation: none; }`.

- [ ] **Step 4: Run** `npx vitest run src/store/booth.test.ts src/screens/Booth.test.tsx` — Expected: PASS (existing booth tests, incl. "pack mode shows the viewfinder…", still pass: the side screen canvas carries "Arcana Pack live preview").
- [ ] **Step 5: Commit** `feat: show a pixel instant camera with a live side screen in the booth`

---

### Task 5: Instant print

**Files:**
- Create: `src/screens/InstantPrint.tsx`
- Modify: `src/screens/Booth.tsx`, `src/index.css`
- Test: `src/screens/Booth.test.tsx`

**Interfaces:**
- Consumes: `usePrintSequence` (Task 3), `CameraStage` `flashing` + `children` (Task 4), `capturePackPhoto` (freeze, `src/packs/capture.ts`), `cropPhoto`, `packArt`, `getPack`.
- Produces: `InstantPrint({ photo, mode, packId, reducedMotion, onDone })` — renders the print and flash, calls `onDone()` once at `done`.

- [ ] **Step 1: Failing tests** — append to `src/screens/Booth.test.tsx`:

```tsx
async function uploadInto() {
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 800, height: 600, close: vi.fn() } as unknown as ImageBitmap))
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
  })
}

test('an upload prints, develops, then opens the editor (single mode)', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', mode: 'single', templateId: 'stamp' }, true)
  render(<Booth />)
  await uploadInto()
  expect(document.querySelector('.instant-print')).not.toBeNull()
  expect(useBooth.getState().screen).toBe('booth')
  for (const ms of [150, 900, 1200, 450]) act(() => { vi.advanceTimersByTime(ms) })
  expect(useBooth.getState().screen).toBe('editor')
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('in pack mode the print goes into the pack', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', mode: 'pack', packId: 'classic' }, true)
  render(<Booth />)
  await uploadInto()
  for (const ms of [150, 900, 1200]) act(() => { vi.advanceTimersByTime(ms) })
  expect(document.querySelector('.instant-print')!.getAttribute('data-phase')).toBe('handoff')
  expect(document.querySelector('.print-pack')).not.toBeNull()
  act(() => { vi.advanceTimersByTime(450) })
  expect(useBooth.getState().screen).toBe('pack')
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('a key during develop skips straight to the card, capturing once', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  const before = useStats.getState().photos
  render(<Booth />)
  await uploadInto()
  act(() => { vi.advanceTimersByTime(150 + 900) })
  fireEvent.keyDown(window, { key: 'x' })
  act(() => { vi.advanceTimersByTime(5000) })
  expect(useBooth.getState().screen).toBe('editor')
  expect(useStats.getState().photos).toBe(before + 1)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('leaving mid-print captures nothing', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  const before = useStats.getState().photos
  const { unmount } = render(<Booth />)
  await uploadInto()
  unmount()
  act(() => { vi.advanceTimersByTime(5000) })
  expect(useBooth.getState().capture).toBeNull()
  expect(useStats.getState().photos).toBe(before)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('the frozen frame is copied once at capture time', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  const bmp = { width: 800, height: 600, close: vi.fn() }
  vi.stubGlobal('createImageBitmap', () => Promise.resolve(bmp as unknown as ImageBitmap))
  render(<Booth />)
  const input = screen.getByLabelText(/upload photo/i) as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } })
  })
  // The bitmap is released right after freezing, before the print finishes.
  expect(bmp.close).toHaveBeenCalled()
  for (const ms of [150, 900, 1200, 450]) act(() => { vi.advanceTimersByTime(ms) })
  expect(useBooth.getState().capture!.source).not.toBe(bmp)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})

test('reduced motion skips the print entirely', async () => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }),
  })
  useBooth.setState({ ...useBooth.getInitialState(), screen: 'booth', templateId: 'stamp' }, true)
  render(<Booth />)
  await uploadInto()
  expect(useBooth.getState().screen).toBe('editor')
  Reflect.deleteProperty(window, 'matchMedia')
  vi.unstubAllGlobals()
  useBooth.setState(useBooth.getInitialState(), true)
})
```

(Import `useStats` from `../store/stats`.)

- [ ] **Step 2: Run** — Expected: FAIL (no `.instant-print`; upload goes straight to the editor).

- [ ] **Step 3: Implement**

`src/screens/InstantPrint.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { getPack } from '../packs/catalog'
import { packArt } from '../packs/packArt'
import { cropPhoto, type PhotoSource } from '../photo/crop'
import { usePrintSequence } from './usePrintSequence'

const PRINT_PHOTO = { w: 276, h: 368 } // 3:4, instant-film picture proportions

interface Props {
  photo: PhotoSource
  mode: 'single' | 'pack'
  packId: string
  reducedMotion: boolean
  onDone: () => void
  onFlash: (on: boolean) => void
}

export function InstantPrint({ photo, mode, packId, reducedMotion, onDone, onFlash }: Props) {
  const { phase, skip } = usePrintSequence(reducedMotion)
  const photoRef = useRef<HTMLCanvasElement>(null)
  const packRef = useRef<HTMLCanvasElement>(null)
  const done = useRef(false)
  const finish = useRef(onDone)
  useEffect(() => {
    finish.current = onDone
  })

  useEffect(() => {
    const c = photoRef.current
    if (!c) return
    const crop = cropPhoto(photo, PRINT_PHOTO.w, PRINT_PHOTO.h)
    c.getContext('2d')!.drawImage(crop.source, 0, 0)
  }, [photo])

  useEffect(() => {
    if (mode === 'pack' && packRef.current) packArt(getPack(packId), 3, packRef.current)
  }, [mode, packId])

  useEffect(() => onFlash(phase === 'flash'), [phase, onFlash])

  // Hand off exactly once.
  useEffect(() => {
    if (phase !== 'done' || done.current) return
    done.current = true
    finish.current()
  }, [phase])

  return (
    <button
      className="instant-print"
      data-phase={phase}
      data-mode={mode}
      aria-label={mode === 'pack' ? 'Skip to your pack' : 'Skip to your card'}
      onClick={skip}
    >
      <span className="print-paper">
        <canvas ref={photoRef} width={PRINT_PHOTO.w} height={PRINT_PHOTO.h} className="print-photo stamp-canvas" aria-hidden="true" />
      </span>
      {mode === 'pack' && <canvas ref={packRef} className="print-pack" aria-hidden="true" />}
    </button>
  )
}
```

`src/screens/Booth.tsx`:
- `const [reducedMotion] = useState(prefersReducedMotion)`; `const [printing, setPrinting] = useState<PhotoSource | null>(null)`; `const [flashing, setFlashing] = useState(false)`.
- Rename the existing `keep` usage: add

```tsx
  // Freeze the frame now (the video keeps moving), then print it before handing off.
  const capture = useCallback(
    (photo: PhotoSource) => {
      const frozen = capturePackPhoto(photo)
      if (reducedMotion) return keep(frozen)
      setPrinting(frozen)
    },
    [keep, reducedMotion],
  )
```

- Countdown effect: replace `if (photo) keep(photo)` with `if (photo) capture(photo)` (deps updated).
- Upload: replace `if (mounted.current) keep({ source: bmp, w: bmp.width, h: bmp.height })` with `if (mounted.current) capture({ source: bmp, w: bmp.width, h: bmp.height })` (the `bmp.close()` right after stays — the frame is already frozen).
- Disable during print: Take photo `disabled={status !== 'live' || count !== null || printing !== null}`; Upload input `disabled={printing !== null}`; toggle `disabled={printing !== null}`; `shutterEnabled` also requires `!printing`.
- Pass `flashing={flashing}` to `CameraStage` and render the print as its child:

```tsx
        {printing && (
          <InstantPrint
            photo={printing}
            mode={mode}
            packId={packId}
            reducedMotion={reducedMotion}
            onFlash={setFlashing}
            onDone={() => {
              if (mounted.current) keep(printing)
            }}
          />
        )}
```

- Add a full-screen flash overlay: `{flashing && <div className="screen-flash" aria-hidden="true" />}`.

`src/index.css`:

```css
/* Instant print */
.instant-print {
  position: absolute; left: 50%; bottom: 96%; z-index: 0; width: 30%; translate: -50% 0;
  background: none; border: 0; padding: 0; cursor: pointer;
}
.print-paper {
  display: block; background: #f7f5ef; padding: 6% 6% 22%; border-radius: 3px;
  box-shadow: 0 6px 0 rgb(0 0 0 / 0.35);
}
.print-photo { display: block; width: 100%; height: auto; }
.instant-print[data-phase='flash'] { translate: -50% 100%; opacity: 0; }
.instant-print[data-phase='eject'] { animation: print-eject 900ms cubic-bezier(.3, .9, .4, 1) both; }
@keyframes print-eject { from { translate: -50% 100%; } to { translate: -50% 0; } }
.instant-print[data-phase='eject'] .print-photo { filter: brightness(1.9) saturate(0) contrast(0.5); }
.instant-print[data-phase='develop'] .print-photo { animation: print-develop 1200ms ease-in both; }
@keyframes print-develop {
  from { filter: brightness(1.9) saturate(0) contrast(0.5); }
  to { filter: none; }
}
.instant-print[data-mode='single'][data-phase='handoff'] { animation: print-flip 450ms ease-in both; }
@keyframes print-flip { to { transform: perspective(700px) rotateY(90deg); } }
.print-pack { position: absolute; left: 50%; top: 120%; width: 130%; translate: -50% 0; opacity: 0; }
.instant-print[data-mode='pack'][data-phase='handoff'] .print-paper { animation: print-into-pack 450ms ease-in both; }
.instant-print[data-mode='pack'][data-phase='handoff'] .print-pack { animation: pack-rise 450ms ease-out both; }
@keyframes print-into-pack { to { translate: 0 140%; scale: 0.6; opacity: 0; } }
@keyframes pack-rise { from { opacity: 0; translate: -50% 40%; } to { opacity: 1; translate: -50% 0; } }
.camera-holder .tilt { position: relative; z-index: 1; }
.screen-flash { position: fixed; inset: 0; z-index: 20; background: #fff; pointer-events: none; animation: screen-flash 300ms ease-out forwards; }
@keyframes screen-flash { from { opacity: 0.9; } to { opacity: 0; } }
```

(The print sits behind the camera (`z-index: 0` vs the tilt's `1`) so it appears to come out of the top slot. In the reduced-motion block add `.instant-print, .instant-print *, .screen-flash { animation: none; }` — the sequence never mounts then anyway.)

- [ ] **Step 4: Run** `npx vitest run src/screens/Booth.test.tsx` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: instant print ejects, develops and hands off to the card or pack`

---

### Task 6: Reduced-motion guard and browser verification

- [ ] **Step 1:** Append to `src/styles.test.ts`'s reduced-motion selector list (`reduced motion switches off every new animation`): `.camera-flip`, `.camera-flash.on`, `.instant-print`, `.screen-flash`. Run — Expected: PASS.
- [ ] **Step 2: Chrome** (dev server 5199, scratchpad CDP driver with fake camera): front at 1366 and 375 px (no horizontal scroll); Show back (mid-flip and settled); single-mode capture with screenshots at flash/eject/develop/handoff; pack-mode capture through to the sealed pack; upload path; `REDUCED=1` capture goes straight to the editor. Compare the camera art against the reference shapes (silver body, brown leather, lens, shutter, flash, copper dial) and polish colours/positions in `cameraArt.ts` if anything reads wrong (visual-only changes; keep tests green).
- [ ] **Step 3: Commit** `test: guard reduced motion for the camera and print` plus any `fix:`/`style:` commits.
