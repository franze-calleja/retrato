# Print Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print several cards per page — copies of the current card from the editor, or a memory-only print tray of different cards — at real size with cut marks, on A4 or Letter.

**Architecture:** A pure mm layout module (`src/print/layout.ts`) packs card rectangles into pages and computes cut marks. A `PrintSheets` component renders those pages into the existing print-only portal and reports when every image has loaded. A memory-only Zustand tray store holds frozen card PNGs (object URLs); a Tray screen overlays the current screen. Paper size joins the persisted operator settings.

**Tech Stack:** Vite 8, React 19.2, TypeScript ~6.0, Zustand 5, Vitest 4.1 (jsdom, vitest-canvas-mock), @testing-library/react 16.

**Spec:** `docs/superpowers/specs/2026-10-14-print-sheets-design.md`

## Global Constraints

- No new dependencies. Do not upgrade any dependency.
- Tray is memory only: nothing about it is written to localStorage/IndexedDB.
- Paper ids exactly `'a4' | 'letter'`; default `'a4'`; persisted inside `pixel-booth:operator`.
- `MARGIN = 10` mm, `GAP = 4` mm, `TRAY_MAX = 20`, `MAX_COPIES = 20`.
- Cards print at `template.printSizeMm`, rendered with `EXPORT_SCALE` and `SNAPSHOT_ANGLE` (same as Download).
- Copy wording: "Add to tray", "Added to tray", "Tray full (20)", "Couldn't add this card", "Print tray (N)", "Your tray is empty", "Done printing?", "Clear tray", "Keep", "Back".
- Numbers in UI use the `.num` class (Pixelify digits are illegible).
- Conventional Commits, no AI attribution lines.
- Test command for the whole suite: `npx vitest run`; also `npx tsc -b && npm run lint` before each commit.

## Review Focus

1. Tray edited while its sheet images are still loading → Print must still fire once all images of the *current* layout load (the sheet is remounted by key; old counts never leak). Test in Task 4 (remount) and Task 6 (print waits for ready).
2. Pressing Print in the editor twice → each press prints exactly once, from a fresh job (keyed remount). Test in Task 5.
3. Object URLs leak when a card is removed, the tray is cleared, or Add fails because the tray is full. Tests in Task 3 and Task 5.
4. Letter vs A4 printable area: cards must never be placed outside the printable area (except an oversized card alone on its page). Tests in Task 1.
5. Opening the tray from any screen and pressing Back returns to the same screen with the booth store untouched. Test in Task 6.

---

### Task 1: Layout module

**Files:**
- Create: `src/print/layout.ts`
- Test: `src/print/layout.test.ts`

**Interfaces:**
- Produces:
  - `type PaperId = 'a4' | 'letter'`
  - `PAPER: Record<PaperId, { w: number; h: number }>`, `MARGIN`, `GAP`, `CUT_MARK`, `CUT_OFFSET`, `CUT_WIDTH`
  - `printableArea(paper: PaperId): { w: number; h: number }`
  - `interface SheetItem { src: string; w: number; h: number }`, `interface Placed extends SheetItem { x: number; y: number }`, `interface Page { cards: Placed[] }`
  - `packSheets(items: SheetItem[], paper: PaperId): Page[]`
  - `fitCount(size: { w: number; h: number }, paper: PaperId): number`
  - `interface Rect { x: number; y: number; w: number; h: number }`, `cutMarks(card: Rect): Rect[]` (8 rects)

- [ ] **Step 1: Write the failing tests** — `src/print/layout.test.ts`

```ts
import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { CUT_MARK, CUT_OFFSET, GAP, cutMarks, fitCount, packSheets, printableArea, type SheetItem } from './layout'

const card = (w: number, h: number, src = 'x'): SheetItem => ({ src, w, h })
const many = (n: number, w: number, h: number) => Array.from({ length: n }, (_, i) => card(w, h, `c${i}`))

test('printable area is paper minus 10 mm margins', () => {
  expect(printableArea('a4')).toEqual({ w: 190, h: 277 })
  const l = printableArea('letter')
  expect(l.w).toBeCloseTo(195.9)
  expect(l.h).toBeCloseTo(259.4)
})

test('no items → no pages', () => {
  expect(packSheets([], 'a4')).toEqual([])
})

test('cards sit left to right with a 4 mm gap', () => {
  const [page] = packSheets(many(3, 50, 62), 'a4')
  expect(page.cards.map((c) => [c.x, c.y])).toEqual([[0, 0], [54, 0], [108, 0]])
})

test('a card that does not fit the row width starts a new row below the tallest card', () => {
  const pages = packSheets([card(120, 60), card(50, 62), card(144, 60)], 'a4')
  expect(pages).toHaveLength(1)
  expect(pages[0].cards.map((c) => [c.x, c.y])).toEqual([[0, 0], [124, 0], [0, 66]])
})

test('a row that does not fit the page height starts a new page', () => {
  // 144×60 tickets: one per row, rows at 0, 64, 128, 192 (ends 252 ≤ 277); fifth needs 256+60 > 277.
  const pages = packSheets(many(5, 144, 60), 'a4')
  expect(pages.map((p) => p.cards.length)).toEqual([4, 1])
  expect(pages[1].cards[0]).toMatchObject({ x: 0, y: 0, src: 'c4' })
})

test('tray order is kept', () => {
  const pages = packSheets(many(7, 63, 88), 'a4')
  expect(pages.flatMap((p) => p.cards.map((c) => c.src))).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
})

test('A4 and Letter can need different page counts', () => {
  // Letter printable height 259.4 fits 4 rows of 60 mm (252) but not with 62 mm cards (4×62+3×4=260).
  const items = many(4 * 3, 50, 62)
  expect(packSheets(items, 'a4')).toHaveLength(1)
  expect(packSheets(items, 'letter')).toHaveLength(2)
})

test('every placed card stays inside the printable area', () => {
  for (const paper of ['a4', 'letter'] as const) {
    const area = printableArea(paper)
    const items = templates.flatMap((t) => many(5, t.printSizeMm.w, t.printSizeMm.h))
    for (const page of packSheets(items, paper))
      for (const c of page.cards) {
        expect(c.x + c.w).toBeLessThanOrEqual(area.w + 1e-6)
        expect(c.y + c.h).toBeLessThanOrEqual(area.h + 1e-6)
      }
  }
})

test('an oversized card gets a page of its own', () => {
  const pages = packSheets([card(50, 62), card(300, 50), card(50, 62)], 'a4')
  expect(pages.map((p) => p.cards.map((c) => [c.w, c.x, c.y]))).toEqual([[[50, 0, 0]], [[300, 0, 0]], [[50, 0, 0]]])
})

test('fitCount is exactly how many copies fit on one page, for every card and paper', () => {
  for (const paper of ['a4', 'letter'] as const)
    for (const t of templates) {
      const { w, h } = t.printSizeMm
      const n = fitCount(t.printSizeMm, paper)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(packSheets(many(n, w, h), paper)).toHaveLength(1)
      expect(packSheets(many(n + 1, w, h), paper)).toHaveLength(2)
    }
})

test('fitCount is at least 1 even for an oversized card', () => {
  expect(fitCount({ w: 400, h: 400 }, 'a4')).toBe(1)
})

test('cut marks: 8 thin lines on the card edges extended outward, inside the gap', () => {
  const c = { x: 10, y: 20, w: 50, h: 62 }
  const marks = cutMarks(c)
  expect(marks).toHaveLength(8)
  for (const m of marks) {
    const overlapsCard = m.x < c.x + c.w && m.x + m.w > c.x && m.y < c.y + c.h && m.y + m.h > c.y
    expect(overlapsCard).toBe(false)
  }
  expect(CUT_OFFSET + CUT_MARK).toBeLessThanOrEqual(GAP)
  // top-left horizontal mark ends CUT_OFFSET left of the card
  expect(marks).toContainEqual(expect.objectContaining({ x: c.x - CUT_OFFSET - CUT_MARK, w: CUT_MARK }))
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/print/layout.test.ts`
Expected: FAIL — cannot resolve `./layout`.

- [ ] **Step 3: Implement** — `src/print/layout.ts`

```ts
// Print layout in millimetres. Pure: no DOM.

export type PaperId = 'a4' | 'letter'

export const PAPER: Record<PaperId, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
}
export const MARGIN = 10
export const GAP = 4
export const CUT_MARK = 3
export const CUT_OFFSET = 0.5
export const CUT_WIDTH = 0.2

const EPS = 1e-6

export interface SheetItem { src: string; w: number; h: number }
export interface Placed extends SheetItem { x: number; y: number }
export interface Page { cards: Placed[] }
export interface Rect { x: number; y: number; w: number; h: number }

export function printableArea(paper: PaperId) {
  const p = PAPER[paper]
  return { w: p.w - 2 * MARGIN, h: p.h - 2 * MARGIN }
}

/** Shelf packing in input order: left to right, new row when the width runs out, new page when the height does. */
export function packSheets(items: SheetItem[], paper: PaperId): Page[] {
  const area = printableArea(paper)
  const pages: Page[] = []
  let page: Page | null = null
  let x = 0
  let y = 0
  let rowH = 0
  const newPage = () => {
    page = { cards: [] }
    pages.push(page)
    x = y = rowH = 0
    return page
  }
  for (const it of items) {
    const oversized = it.w > area.w + EPS || it.h > area.h + EPS
    let p: Page = page ?? newPage()
    if (oversized) {
      if (p.cards.length) p = newPage()
      p.cards.push({ ...it, x: 0, y: 0 })
      page = null
      continue
    }
    if (x > 0 && x + it.w > area.w + EPS) {
      y += rowH + GAP
      x = 0
      rowH = 0
    }
    if (p.cards.length && y + it.h > area.h + EPS) p = newPage()
    p.cards.push({ ...it, x, y })
    x += it.w + GAP
    rowH = Math.max(rowH, it.h)
  }
  return pages
}

/** How many copies of one card size fit on a single page (at least 1). */
export function fitCount(size: { w: number; h: number }, paper: PaperId): number {
  const area = printableArea(paper)
  const cols = Math.floor((area.w + GAP) / (size.w + GAP) + EPS)
  const rows = Math.floor((area.h + GAP) / (size.h + GAP) + EPS)
  return Math.max(1, cols * rows)
}

/** Eight thin lines continuing each card edge outward from its corners. */
export function cutMarks(c: Rect): Rect[] {
  const marks: Rect[] = []
  for (const [cx, dx] of [[c.x, -1], [c.x + c.w, 1]] as const)
    for (const [cy, dy] of [[c.y, -1], [c.y + c.h, 1]] as const) {
      marks.push({ x: dx < 0 ? cx - CUT_OFFSET - CUT_MARK : cx + CUT_OFFSET, y: cy - CUT_WIDTH / 2, w: CUT_MARK, h: CUT_WIDTH })
      marks.push({ x: cx - CUT_WIDTH / 2, y: dy < 0 ? cy - CUT_OFFSET - CUT_MARK : cy + CUT_OFFSET, w: CUT_WIDTH, h: CUT_MARK })
    }
  return marks
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/print/layout.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
npx tsc -b && npm run lint
git add src/print/layout.ts src/print/layout.test.ts
git commit -m "feat: add print sheet layout with shelf packing and cut marks"
```

---

### Task 2: Paper setting

**Files:**
- Modify: `src/store/operator.ts`, `src/screens/OperatorPanel.tsx`
- Test: `src/store/operator.test.ts`, `src/screens/OperatorPanel.test.tsx`

**Interfaces:**
- Consumes: `PaperId` from `src/print/layout.ts`.
- Produces: `useOperator` state gains `paper: PaperId` and `setPaper(paper: string): void`; `isPaper(v: unknown): v is PaperId`; `loadPaper(): PaperId`. `reset()` also sets `paper: 'a4'`. Persisted JSON becomes `{ weights, forced, paper }`.

- [ ] **Step 1: Write the failing tests**

In `src/store/operator.test.ts`, update the existing persistence assertion to include paper:

```ts
  expect(JSON.parse(localStorage.getItem(OPERATOR_KEY)!)).toEqual({
    weights: { common: 60, foil: 25, holo: 50, poly: 3 },
    forced: 'poly',
    paper: 'a4',
  })
```

and append:

```ts
test('paper defaults to A4, persists, and restores', () => {
  expect(useOperator.getState().paper).toBe('a4')
  useOperator.getState().setPaper('letter')
  expect(useOperator.getState().paper).toBe('letter')
  expect(JSON.parse(localStorage.getItem(OPERATOR_KEY)!).paper).toBe('letter')
  expect(loadPaper()).toBe('letter')
})

test('unknown or corrupt paper falls back to A4', () => {
  useOperator.getState().setPaper('tabloid')
  expect(useOperator.getState().paper).toBe('a4')
  localStorage.setItem(OPERATOR_KEY, JSON.stringify({ paper: 42 }))
  expect(loadPaper()).toBe('a4')
  localStorage.setItem(OPERATOR_KEY, '{nope')
  expect(loadPaper()).toBe('a4')
})

test('reset puts paper back to A4', () => {
  useOperator.getState().setPaper('letter')
  useOperator.getState().reset()
  expect(useOperator.getState().paper).toBe('a4')
})
```

(Add `loadPaper` to the import from `./operator`.)

In `src/screens/OperatorPanel.test.tsx` append:

```ts
test('paper select sets the paper size', () => {
  render(<App />)
  fireEvent.keyDown(window, { code: 'KeyO', shiftKey: true, altKey: true })
  fireEvent.change(screen.getByLabelText(/paper/i), { target: { value: 'letter' } })
  expect(useOperator.getState().paper).toBe('letter')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/store/operator.test.ts src/screens/OperatorPanel.test.tsx`
Expected: FAIL — `loadPaper` not exported / `setPaper` not a function / no Paper label; persistence test fails on missing `paper`.

- [ ] **Step 3: Implement**

`src/store/operator.ts` — add imports and paper handling (keep `EditionSettings`, `sanitize`, `defaultSettings` unchanged):

```ts
import type { PaperId } from '../print/layout'
```

```ts
export const isPaper = (v: unknown): v is PaperId => v === 'a4' || v === 'letter'

export function loadPaper(): PaperId {
  const raw = readJson(OPERATOR_KEY) as { paper?: unknown } | null
  return raw && typeof raw === 'object' && isPaper(raw.paper) ? raw.paper : 'a4'
}

function save({ weights, forced, paper }: EditionSettings & { paper: PaperId }) {
  writeJson(OPERATOR_KEY, { weights, forced, paper })
}

interface OperatorState extends EditionSettings {
  paper: PaperId
  setWeight(id: string, weight: number): void
  setForced(forced: string): void
  setPaper(paper: string): void
  reset(): void
}

export const useOperator = create<OperatorState>()((set, get) => ({
  ...loadSettings(),
  paper: loadPaper(),
  // setWeight, setForced unchanged
  setPaper(paper) {
    if (!isPaper(paper)) return
    set({ paper })
    save(get())
  },
  reset() {
    set({ ...defaultSettings(), paper: 'a4' })
    save(get())
  },
}))
```

(Replace the old `save` and `reset`; leave `setWeight`/`setForced` bodies as they are.)

`src/screens/OperatorPanel.tsx` — read `paper`, `setPaper` and add after the Force edition label:

```tsx
  const paper = useOperator((s) => s.paper)
  const { setWeight, setForced, setPaper, reset } = useOperator.getState()
```

```tsx
        <label className="operator-row">
          <span>Paper</span>
          <select value={paper} onChange={(ev) => setPaper(ev.target.value)}>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
          </select>
        </label>
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/store/operator.test.ts src/screens/OperatorPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/store/operator.ts src/store/operator.test.ts src/screens/OperatorPanel.tsx src/screens/OperatorPanel.test.tsx
git commit -m "feat: add A4/Letter paper setting to the operator panel"
```

---

### Task 3: Tray store

**Files:**
- Create: `src/store/tray.ts`
- Modify: `src/test/setup.ts` (object URL stubs for jsdom)
- Test: `src/store/tray.test.ts`

**Interfaces:**
- Consumes: `SheetItem` from `src/print/layout.ts`.
- Produces:
  - `TRAY_MAX = 20`, `MAX_COPIES = 20`, `clampCopies(n: number): number`
  - `interface TrayItem { id: string; templateId: string; name: string; edition: string; url: string; size: { w: number; h: number }; copies: number }`
  - `useTray` with `items: TrayItem[]`, `open: boolean`, `add(item: Omit<TrayItem, 'id'>): boolean`, `setCopies(id: string, n: number)`, `remove(id: string)`, `clear()`, `show()`, `hide()`
  - `trayCopies(items: TrayItem[]): number`, `traySheetItems(items: TrayItem[]): SheetItem[]`

- [ ] **Step 1: Add jsdom object URL stubs** — append to `src/test/setup.ts`:

```ts
// jsdom has no object URLs; tests spy on these.
if (!URL.createObjectURL) URL.createObjectURL = () => `blob:test/${Math.random().toString(36).slice(2)}`
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}
```

- [ ] **Step 2: Write the failing tests** — `src/store/tray.test.ts`

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MAX_COPIES, TRAY_MAX, clampCopies, trayCopies, traySheetItems, useTray, type TrayItem } from './tray'

const item = (n = 1): Omit<TrayItem, 'id'> => ({
  templateId: 'stamp', name: 'Stamp', edition: 'foil', url: `blob:${n}`, size: { w: 50, h: 62 }, copies: 1,
})

beforeEach(() => useTray.setState(useTray.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

test('add appends with a unique id and clamped copies', () => {
  expect(useTray.getState().add({ ...item(1), copies: 99 })).toBe(true)
  expect(useTray.getState().add({ ...item(2), copies: 0 })).toBe(true)
  const [a, b] = useTray.getState().items
  expect(a.id).not.toBe(b.id)
  expect([a.copies, b.copies]).toEqual([MAX_COPIES, 1])
})

test('the tray holds at most 20 entries', () => {
  for (let i = 0; i < TRAY_MAX; i++) expect(useTray.getState().add(item(i))).toBe(true)
  expect(useTray.getState().add(item(99))).toBe(false)
  expect(useTray.getState().items).toHaveLength(TRAY_MAX)
})

test('clampCopies keeps 1–20 and never NaN', () => {
  expect([clampCopies(0), clampCopies(3.6), clampCopies(50), clampCopies(NaN), clampCopies(Infinity)]).toEqual([1, 4, 20, 1, 1])
})

test('setCopies clamps', () => {
  useTray.getState().add(item())
  const id = useTray.getState().items[0].id
  useTray.getState().setCopies(id, 7)
  expect(useTray.getState().items[0].copies).toBe(7)
  useTray.getState().setCopies(id, -2)
  expect(useTray.getState().items[0].copies).toBe(1)
})

test('remove revokes that entry’s image URL', () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL')
  useTray.getState().add(item(1))
  useTray.getState().add(item(2))
  useTray.getState().remove(useTray.getState().items[0].id)
  expect(revoke).toHaveBeenCalledWith('blob:1')
  expect(useTray.getState().items.map((i) => i.url)).toEqual(['blob:2'])
})

test('clear revokes every URL, empties and hides the tray', () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL')
  useTray.getState().add(item(1))
  useTray.getState().add(item(2))
  useTray.getState().show()
  useTray.getState().clear()
  expect(revoke.mock.calls.map((c) => c[0])).toEqual(['blob:1', 'blob:2'])
  expect(useTray.getState()).toMatchObject({ items: [], open: false })
})

test('show and hide toggle the tray screen', () => {
  useTray.getState().show()
  expect(useTray.getState().open).toBe(true)
  useTray.getState().hide()
  expect(useTray.getState().open).toBe(false)
})

test('copies expand into sheet items in tray order', () => {
  useTray.getState().add({ ...item(1), copies: 2 })
  useTray.getState().add({ ...item(2), size: { w: 144, h: 60 } })
  const { items } = useTray.getState()
  expect(trayCopies(items)).toBe(3)
  expect(traySheetItems(items)).toEqual([
    { src: 'blob:1', w: 50, h: 62 }, { src: 'blob:1', w: 50, h: 62 }, { src: 'blob:2', w: 144, h: 60 },
  ])
})

test('the tray never touches storage', () => {
  const set = vi.spyOn(Storage.prototype, 'setItem')
  useTray.getState().add(item())
  useTray.getState().setCopies(useTray.getState().items[0].id, 3)
  useTray.getState().clear()
  expect(set).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/store/tray.test.ts`
Expected: FAIL — cannot resolve `./tray`.

- [ ] **Step 4: Implement** — `src/store/tray.ts`

```ts
import { create } from 'zustand'
import type { SheetItem } from '../print/layout'

// Memory only by design: guest photos are never written to storage.

export const TRAY_MAX = 20
export const MAX_COPIES = 20

export interface TrayItem {
  id: string
  templateId: string
  name: string
  /** Edition id. */
  edition: string
  /** Object URL of the frozen card PNG. */
  url: string
  /** Print size in mm. */
  size: { w: number; h: number }
  copies: number
}

export const clampCopies = (n: number) => (Number.isFinite(n) ? Math.min(MAX_COPIES, Math.max(1, Math.round(n))) : 1)

export const trayCopies = (items: TrayItem[]) => items.reduce((n, i) => n + i.copies, 0)

export const traySheetItems = (items: TrayItem[]): SheetItem[] =>
  items.flatMap((i) => Array.from({ length: i.copies }, () => ({ src: i.url, w: i.size.w, h: i.size.h })))

interface TrayState {
  items: TrayItem[]
  /** The tray screen is showing. */
  open: boolean
  add(item: Omit<TrayItem, 'id'>): boolean
  setCopies(id: string, n: number): void
  remove(id: string): void
  clear(): void
  show(): void
  hide(): void
}

let nextId = 0

export const useTray = create<TrayState>()((set, get) => ({
  items: [],
  open: false,
  add(item) {
    if (get().items.length >= TRAY_MAX) return false
    set({ items: [...get().items, { ...item, id: `tray-${++nextId}`, copies: clampCopies(item.copies) }] })
    return true
  },
  setCopies(id, n) {
    set({ items: get().items.map((i) => (i.id === id ? { ...i, copies: clampCopies(n) } : i)) })
  },
  remove(id) {
    const gone = get().items.find((i) => i.id === id)
    if (!gone) return
    URL.revokeObjectURL(gone.url)
    set({ items: get().items.filter((i) => i.id !== id) })
  },
  clear() {
    for (const i of get().items) URL.revokeObjectURL(i.url)
    set({ items: [], open: false })
  },
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/store/tray.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/store/tray.ts src/store/tray.test.ts src/test/setup.ts
git commit -m "feat: add memory-only print tray store"
```

---

### Task 4: PrintSheets print view

**Files:**
- Create: `src/print/PrintSheets.tsx`
- Modify: `src/index.css` (print page styles)
- Test: `src/print/PrintSheets.test.tsx`

**Interfaces:**
- Consumes: `Page`, `PaperId`, `printableArea`, `cutMarks`, `MARGIN` from Task 1.
- Produces: `PrintSheets({ pages, paper, onReady }: { pages: Page[]; paper: PaperId; onReady?: () => void })`. Portals into `.app` (falls back to `document.body` when `.app` is missing). Fires `onReady` once after every card `<img>` has loaded or errored (immediately on mount for zero cards). Callers remount it with a new `key` for each new job; it never resets its count itself.

- [ ] **Step 1: Write the failing tests** — `src/print/PrintSheets.test.tsx`

```tsx
import { fireEvent, render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { packSheets, type SheetItem } from './layout'
import { PrintSheets } from './PrintSheets'

const items = (n: number, w = 144, h = 60): SheetItem[] => Array.from({ length: n }, (_, i) => ({ src: `blob:${i}`, w, h }))
const imgs = () => [...document.querySelectorAll<HTMLImageElement>('.print-page img')]

test('renders one page box per page, sized to the printable area', () => {
  render(<PrintSheets pages={packSheets(items(5), 'a4')} paper="a4" />)
  const pages = document.querySelectorAll<HTMLElement>('.print-page')
  expect(pages).toHaveLength(2)
  expect(pages[0].style.width).toBe('190mm')
  expect(pages[0].style.height).toBe('277mm')
})

test('cards are placed at real size in mm, with 8 cut marks each', () => {
  render(<PrintSheets pages={packSheets(items(2, 50, 62), 'a4')} paper="a4" />)
  const [a, b] = imgs()
  expect([a.style.left, a.style.top, a.style.width, a.style.height]).toEqual(['0mm', '0mm', '50mm', '62mm'])
  expect(b.style.left).toBe('54mm')
  expect(document.querySelectorAll('.cut-mark')).toHaveLength(16)
})

test('sets the @page size for the chosen paper', () => {
  render(<PrintSheets pages={packSheets(items(1), 'letter')} paper="letter" />)
  expect(document.querySelector('.print-sheets style')?.textContent).toMatch(/size:\s*letter/)
})

test('onReady fires once, after every image has loaded or failed', () => {
  const onReady = vi.fn()
  render(<PrintSheets pages={packSheets(items(3), 'a4')} paper="a4" onReady={onReady} />)
  const [a, b, c] = imgs()
  fireEvent.load(a)
  fireEvent.error(b)
  expect(onReady).not.toHaveBeenCalled()
  fireEvent.load(c)
  expect(onReady).toHaveBeenCalledTimes(1)
})

test('onReady fires immediately with no cards', () => {
  const onReady = vi.fn()
  render(<PrintSheets pages={[]} paper="a4" onReady={onReady} />)
  expect(onReady).toHaveBeenCalledTimes(1)
})

test('a remount with a new key waits for the new images only', () => {
  const onReady = vi.fn()
  const { rerender } = render(<PrintSheets key="1" pages={packSheets(items(2), 'a4')} paper="a4" onReady={onReady} />)
  fireEvent.load(imgs()[0])
  rerender(<PrintSheets key="2" pages={packSheets(items(3), 'a4')} paper="a4" onReady={onReady} />)
  const fresh = imgs()
  expect(fresh).toHaveLength(3)
  fireEvent.load(fresh[0])
  fireEvent.load(fresh[1])
  expect(onReady).not.toHaveBeenCalled()
  fireEvent.load(fresh[2])
  expect(onReady).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/print/PrintSheets.test.tsx`
Expected: FAIL — cannot resolve `./PrintSheets`.

- [ ] **Step 3: Implement** — `src/print/PrintSheets.tsx`

```tsx
import { Fragment, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MARGIN, cutMarks, printableArea, type Page, type PaperId, type Rect } from './layout'

const PAGE_SIZE: Record<PaperId, string> = { a4: 'A4', letter: 'letter' }
const mm = (n: number) => `${n}mm`
const box = (r: Rect) => ({ left: mm(r.x), top: mm(r.y), width: mm(r.w), height: mm(r.h) })

/** Print-only pages of cards. Remount (new key) for each new job; onReady fires once all images settle. */
export function PrintSheets({ pages, paper, onReady }: { pages: Page[]; paper: PaperId; onReady?: () => void }) {
  const total = pages.reduce((n, p) => n + p.cards.length, 0)
  const settled = useRef(0)
  const ready = useRef(onReady)
  useEffect(() => {
    ready.current = onReady
  })
  useEffect(() => {
    if (total === 0) ready.current?.()
    // Mount only: a new job is a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const settle = () => {
    settled.current += 1
    if (settled.current === total) ready.current?.()
  }

  const area = printableArea(paper)
  const root = document.querySelector('.app') ?? document.body

  return createPortal(
    <div className="print-only print-sheets">
      <style>{`@page { size: ${PAGE_SIZE[paper]}; margin: ${MARGIN}mm; }`}</style>
      {pages.map((page, i) => (
        <div key={i} className="print-page" style={{ width: mm(area.w), height: mm(area.h) }}>
          {page.cards.map((c, j) => (
            <Fragment key={j}>
              <img src={c.src} alt="" style={box(c)} onLoad={settle} onError={settle} />
              {cutMarks(c).map((m, k) => (
                <span key={k} className="cut-mark" style={box(m)} />
              ))}
            </Fragment>
          ))}
        </div>
      ))}
    </div>,
    root,
  )
}
```

If lint reports the `eslint-disable` comment as unused (the rule may not be enabled), delete that comment line.

`src/index.css` — after `.print-only { display: none; }` add:

```css
.print-page { position: relative; overflow: visible; break-after: page; }
.print-page:last-child { break-after: auto; }
.print-page img { position: absolute; display: block; }
.cut-mark { position: absolute; background: #8a8a8a; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/print/PrintSheets.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/print/PrintSheets.tsx src/print/PrintSheets.test.tsx src/index.css
git commit -m "feat: add print sheets view with real-size cards and cut marks"
```

---

### Task 5: Editor copies, sheet printing, Add to tray

**Files:**
- Modify: `src/screens/Editor.tsx`, `src/index.css`
- Test: `src/screens/Editor.test.tsx`

**Interfaces:**
- Consumes: `packSheets`, `fitCount`, `Page` (Task 1); `useOperator().paper` (Task 2); `useTray`, `TRAY_MAX` (Task 3); `PrintSheets` (Task 4).
- Produces: Editor UI — `<select aria-label="Copies">` with values `1`, `2`, `4`, `fill`; buttons "Print", "Add to tray" / disabled "Tray full (20)"; status text in `.editor-note` (`role="status"`).

- [ ] **Step 1: Write the failing tests** — append to `src/screens/Editor.test.tsx` (extend imports: `fireEvent, screen, waitFor` from `@testing-library/react`; `vi, beforeEach` from `vitest`; `useTray, TRAY_MAX` from `../store/tray`; `useOperator` from `../store/operator`; `fitCount` from `../print/layout`):

```tsx
beforeEach(() => {
  useTray.setState(useTray.getInitialState(), true)
  useOperator.getState().setPaper('a4')
  window.print = vi.fn()
})

const printImgs = () => [...document.querySelectorAll<HTMLImageElement>('.print-page img')]

test('Print lays out the chosen number of copies and prints once they load', () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  const imgs = printImgs()
  expect(imgs).toHaveLength(4)
  expect(imgs[0].style.width).toBe(`${getTemplate('ticket').printSizeMm.w}mm`)
  imgs.forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('Fill page prints as many copies as fit on one page', () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: 'fill' } })
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect(printImgs()).toHaveLength(fitCount(getTemplate('ticket').printSizeMm, 'a4'))
  expect(document.querySelectorAll('.print-page')).toHaveLength(1)
})

test('pressing Print twice prints once per press', () => {
  open(true)
  const print = screen.getByRole('button', { name: 'Print' })
  fireEvent.click(print)
  printImgs().forEach((img) => fireEvent.load(img))
  fireEvent.click(print)
  printImgs().forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(2)
})

test('Print does not touch the tray', () => {
  open(true)
  fireEvent.click(screen.getByRole('button', { name: 'Print' }))
  expect(useTray.getState().items).toHaveLength(0)
})

test('Add to tray stores the card with its copies and confirms', async () => {
  open(true)
  fireEvent.change(screen.getByLabelText(/copies/i), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: /add to tray/i }))
  await waitFor(() => expect(useTray.getState().items).toHaveLength(1))
  expect(useTray.getState().items[0]).toMatchObject({
    templateId: 'ticket', name: getTemplate('ticket').name, edition: 'holo', copies: 2, size: getTemplate('ticket').printSizeMm,
  })
  expect(screen.getByRole('status').textContent).toMatch(/added to tray/i)
})

test('a full tray disables Add and says why', () => {
  for (let i = 0; i < TRAY_MAX; i++)
    useTray.getState().add({ templateId: 'stamp', name: 'Stamp', edition: 'common', url: `blob:${i}`, size: { w: 50, h: 62 }, copies: 1 })
  open(true)
  expect((screen.getByRole('button', { name: /tray full \(20\)/i }) as HTMLButtonElement).disabled).toBe(true)
})

test('a failed render adds nothing and says so', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) { cb(null) })
  open(true)
  fireEvent.click(screen.getByRole('button', { name: /add to tray/i }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/couldn.t add this card/i))
  expect(useTray.getState().items).toHaveLength(0)
  vi.restoreAllMocks()
})
```

Note: the reveal banner also uses `role="status"`, but `open(true)` starts at `shown` with `celebrate` only after the reveal; if `getByRole('status')` finds two, scope it with `screen.getByText(/added to tray/i)` instead and record the change as a ruling.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/screens/Editor.test.tsx`
Expected: FAIL — no Copies control, no Add to tray button.

- [ ] **Step 3: Implement** — `src/screens/Editor.tsx`

Replace the imports of `createPortal` and add:

```tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { fitCount, packSheets, type Page } from '../print/layout'
import { PrintSheets } from '../print/PrintSheets'
import { useOperator } from '../store/operator'
import { TRAY_MAX, useTray } from '../store/tray'
```

Inside `Editor`, replace the `print` state with these hooks (all before `if (!capture) return null`):

```tsx
  const paper = useOperator((s) => s.paper)
  const trayFull = useTray((s) => s.items.length >= TRAY_MAX)
  const [copies, setCopies] = useState('1')
  const [job, setJob] = useState<{ pages: Page[]; n: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(noteTimer.current), [])
```

After `renderFull` / `download`, replace `startPrint` and remove `printRoot`:

```tsx
  const copyCount = copies === 'fill' ? fitCount(template.printSizeMm, paper) : Number(copies)

  function flash(text: string) {
    setNote(text)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), 2000)
  }

  function startPrint() {
    const src = renderFull().toDataURL('image/png')
    const items = Array.from({ length: copyCount }, () => ({ src, ...template.printSizeMm }))
    // New key per press so the sheet remounts and waits for its own images.
    setJob((j) => ({ pages: packSheets(items, paper), n: (j?.n ?? 0) + 1 }))
  }

  function addToTray() {
    renderFull().toBlob((blob) => {
      if (!blob) return flash("Couldn't add this card")
      const url = URL.createObjectURL(blob)
      const added = useTray.getState().add({
        templateId: template.id, name: template.name, edition: edition.id, url, size: template.printSizeMm, copies: copyCount,
      })
      if (!added) URL.revokeObjectURL(url)
      flash(added ? 'Added to tray' : `Tray full (${TRAY_MAX})`)
    }, 'image/png')
  }
```

Replace the Download/Print row and the old portal:

```tsx
      <div className="row">
        <button className="btn gold" onClick={download}>Download PNG</button>
        <label className="copies">
          Copies
          <select value={copies} onChange={(e) => setCopies(e.target.value)}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4</option>
            <option value="fill">Fill page</option>
          </select>
        </label>
        <button className="btn blue" onClick={startPrint}>Print</button>
        <button className="btn green" onClick={addToTray} disabled={trayFull}>
          {trayFull ? `Tray full (${TRAY_MAX})` : 'Add to tray'}
        </button>
      </div>
      <p className="editor-note" role="status">{note}</p>
```

and at the end of the section (where the old portal was):

```tsx
      {job && <PrintSheets key={job.n} pages={job.pages} paper={paper} onReady={() => window.print()} />}
```

`src/index.css` — add near `.row`:

```css
.copies { display: flex; align-items: center; gap: 8px; font-weight: 700; }
.copies select { font: 700 16px var(--font); padding: 6px; background: var(--dark); color: var(--ink); border: 3px solid var(--dark); border-radius: 6px; }
.editor-note { min-height: 1.4em; margin: 0; color: var(--gold); }
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/screens/Editor.test.tsx`
Expected: PASS (all old + 7 new).

- [ ] **Step 5: Commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/Editor.tsx src/screens/Editor.test.tsx src/index.css
git commit -m "feat: print copies on a sheet and add cards to the print tray from the editor"
```

---

### Task 6: Tray screen and header button

**Files:**
- Create: `src/screens/Tray.tsx`
- Modify: `src/App.tsx`, `src/index.css`
- Test: `src/screens/Tray.test.tsx`

**Interfaces:**
- Consumes: `useTray`, `MAX_COPIES`, `trayCopies`, `traySheetItems` (Task 3); `packSheets`, `printableArea`, `Page`, `PaperId` (Task 1); `PrintSheets` (Task 4); `useOperator().paper` (Task 2); `getEdition` from `../editions/registry`.
- Produces: `Tray()` screen; `TrayButton()` (exported from `Tray.tsx`) rendering "Print tray (N)"; App shows `<Tray />` instead of the current screen while `useTray().open`.

- [ ] **Step 1: Write the failing tests** — `src/screens/Tray.test.tsx`

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../App'
import { useBooth } from '../store/booth'
import { useOperator } from '../store/operator'
import { useTray, type TrayItem } from '../store/tray'
import { Tray } from './Tray'

const add = (over: Partial<Omit<TrayItem, 'id'>> = {}) =>
  useTray.getState().add({ templateId: 'ticket', name: 'Ticket', edition: 'foil', url: 'blob:t', size: { w: 144, h: 60 }, copies: 1, ...over })
const printImgs = () => [...document.querySelectorAll<HTMLImageElement>('.print-page img')]

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  useBooth.setState(useBooth.getInitialState(), true)
  useTray.setState(useTray.getInitialState(), true)
  window.print = vi.fn()
})

test('lists entries with name, edition and copies', () => {
  add({ copies: 3 })
  render(<Tray />)
  expect(screen.getByText(/ticket — foil/i)).toBeTruthy()
  expect(screen.getByRole('group', { name: /copies of ticket/i }).textContent).toContain('3')
})

test('stepper changes copies and the page count follows', () => {
  add({ copies: 4 })
  render(<Tray />)
  expect(screen.getByTestId('page-count').textContent).toBe('1 page')
  fireEvent.click(screen.getByRole('button', { name: /more copies/i }))
  expect(useTray.getState().items[0].copies).toBe(5)
  expect(screen.getByTestId('page-count').textContent).toBe('2 pages')
  expect(screen.getByRole('button', { name: /print 2 pages/i })).toBeTruthy()
})

test('Remove drops an entry', () => {
  add()
  add({ name: 'Stamp', templateId: 'stamp', size: { w: 50, h: 62 } })
  render(<Tray />)
  fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0])
  expect(useTray.getState().items.map((i) => i.name)).toEqual(['Stamp'])
})

test('empty tray says so and cannot print', () => {
  render(<Tray />)
  expect(screen.getByText(/your tray is empty/i)).toBeTruthy()
  expect((screen.getByRole('button', { name: /^print/i }) as HTMLButtonElement).disabled).toBe(true)
})

test('Print waits for the sheet images, then prints', () => {
  add({ copies: 2 })
  render(<Tray />)
  fireEvent.click(screen.getByRole('button', { name: /print 1 page/i }))
  expect(window.print).not.toHaveBeenCalled()
  printImgs().forEach((img) => fireEvent.load(img))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('Print after the images loaded prints straight away', () => {
  add()
  render(<Tray />)
  printImgs().forEach((img) => fireEvent.load(img))
  fireEvent.click(screen.getByRole('button', { name: /print 1 page/i }))
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('editing the tray while loading waits for the new layout', () => {
  add()
  render(<Tray />)
  fireEvent.click(screen.getByRole('button', { name: /print 1 page/i }))
  fireEvent.click(screen.getByRole('button', { name: /more copies/i }))
  const imgs = printImgs()
  expect(imgs).toHaveLength(2)
  fireEvent.load(imgs[0])
  expect(window.print).not.toHaveBeenCalled()
  fireEvent.load(imgs[1])
  expect(window.print).toHaveBeenCalledTimes(1)
})

test('after printing, a banner offers to clear or keep the tray', () => {
  add()
  render(<Tray />)
  act(() => { window.dispatchEvent(new Event('afterprint')) })
  expect(screen.getByText(/done printing\?/i)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^keep$/i }))
  expect(screen.queryByText(/done printing\?/i)).toBeNull()
  expect(useTray.getState().items).toHaveLength(1)
  act(() => { window.dispatchEvent(new Event('afterprint')) })
  fireEvent.click(screen.getAllByRole('button', { name: /clear tray/i })[0])
  expect(useTray.getState().items).toHaveLength(0)
})

test('header button shows total copies, opens the tray, and Back returns to the same screen', () => {
  render(<App />)
  expect(screen.queryByRole('button', { name: /print tray/i })).toBeNull()
  act(() => { add({ copies: 3 }) })
  fireEvent.click(screen.getByRole('button', { name: /print tray \(3\)/i }))
  expect(screen.getByRole('heading', { name: /print tray/i })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /print tray \(/i })).toBeNull()
  expect(useBooth.getState().screen).toBe('picker')
  fireEvent.click(screen.getByRole('button', { name: /back/i }))
  expect(screen.queryByRole('heading', { name: /print tray/i })).toBeNull()
  expect(screen.getByRole('button', { name: /print tray \(3\)/i })).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/screens/Tray.test.tsx`
Expected: FAIL — cannot resolve `./Tray`.

- [ ] **Step 3: Implement** — `src/screens/Tray.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { getEdition } from '../editions/registry'
import { packSheets, printableArea, type Page, type PaperId } from '../print/layout'
import { PrintSheets } from '../print/PrintSheets'
import { useOperator } from '../store/operator'
import { MAX_COPIES, trayCopies, traySheetItems, useTray } from '../store/tray'

const plural = (n: number) => `${n} ${n === 1 ? 'page' : 'pages'}`

export function TrayButton() {
  const count = useTray((s) => trayCopies(s.items))
  const open = useTray((s) => s.open)
  if (!count || open) return null
  return (
    <button className="btn gold tray-btn" onClick={useTray.getState().show}>
      Print tray (<span className="num">{count}</span>)
    </button>
  )
}

function SheetPreview({ pages, paper }: { pages: Page[]; paper: PaperId }) {
  const area = printableArea(paper)
  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  return (
    <div className="sheet-preview">
      {pages.map((p, i) => (
        <div
          key={i}
          className="sheet-mini"
          role="img"
          aria-label={`Page ${i + 1}: ${p.cards.length} cards`}
          style={{ aspectRatio: `${area.w} / ${area.h}` }}
        >
          {p.cards.map((c, j) => (
            <span
              key={j}
              style={{ left: pct(c.x, area.w), top: pct(c.y, area.h), width: pct(c.w, area.w), height: pct(c.h, area.h) }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function Tray() {
  const items = useTray((s) => s.items)
  const paper = useOperator((s) => s.paper)
  const { setCopies, remove, clear, hide } = useTray.getState()
  const pages = useMemo(() => packSheets(traySheetItems(items), paper), [items, paper])
  const sheetKey = useMemo(() => JSON.stringify(pages), [pages])
  const readyFor = useRef<string | null>(null)
  const pending = useRef(false)
  const [askClear, setAskClear] = useState(false)

  useEffect(() => {
    const onAfter = () => setAskClear(true)
    window.addEventListener('afterprint', onAfter)
    return () => window.removeEventListener('afterprint', onAfter)
  }, [])

  function print() {
    if (readyFor.current === sheetKey) window.print()
    else pending.current = true
  }

  function onReady() {
    readyFor.current = sheetKey
    if (pending.current) {
      pending.current = false
      window.print()
    }
  }

  return (
    <section className="screen tray">
      <h2>Print tray</h2>
      {askClear && (
        <div className="tray-banner">
          <span>Done printing?</span>
          <button className="btn green" onClick={clear}>Clear tray</button>
          <button className="btn" onClick={() => setAskClear(false)}>Keep</button>
        </div>
      )}
      {items.length === 0 ? (
        <p>Your tray is empty</p>
      ) : (
        <ul className="tray-list">
          {items.map((i) => (
            <li key={i.id} className="tray-item">
              <img className="tray-thumb" src={i.url} alt="" />
              <span className="tray-name">{i.name} — {getEdition(i.edition).name}</span>
              <div className="stepper" role="group" aria-label={`Copies of ${i.name}`}>
                <button className="btn" aria-label="Fewer copies" disabled={i.copies <= 1} onClick={() => setCopies(i.id, i.copies - 1)}>−</button>
                <output className="num">{i.copies}</output>
                <button className="btn" aria-label="More copies" disabled={i.copies >= MAX_COPIES} onClick={() => setCopies(i.id, i.copies + 1)}>+</button>
              </div>
              <button className="btn red" onClick={() => remove(i.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <SheetPreview pages={pages} paper={paper} />
      <p className="num" data-testid="page-count">{plural(pages.length)}</p>
      <div className="row">
        <button className="btn blue" disabled={!items.length} onClick={print}>Print {plural(pages.length)}</button>
        <button className="btn" disabled={!items.length} onClick={clear}>Clear tray</button>
        <button className="btn gold" onClick={hide}>Back</button>
      </div>
      {pages.length > 0 && <PrintSheets key={sheetKey} pages={pages} paper={paper} onReady={onReady} />}
    </section>
  )
}
```

Note: `onReady` closes over the render's `sheetKey`; `PrintSheets` reads the latest `onReady` via its ref, and a changed layout remounts the sheet by key, so `readyFor` only ever matches the current layout.

`src/App.tsx` — import `Tray`, `TrayButton`, `useTray`; read `const trayOpen = useTray((s) => s.open)`; render:

```tsx
        <h1 className="logo" onClick={onLogoTap}>PIXEL BOOTH</h1>
        <TrayButton />
        {trayOpen ? (
          <Tray />
        ) : (
          <>
            {screen === 'picker' && <Shop />}
            {screen === 'booth' && <Booth />}
            {screen === 'pack' && <PackDeal />}
            {screen === 'editor' && <Editor />}
          </>
        )}
        {panelOpen && <OperatorPanel onClose={closePanel} />}
```

`src/index.css` — add:

```css
/* Print tray */
.tray-btn { padding: 8px 14px; font-size: 16px; }
.tray-banner { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; padding: 10px 14px; background: var(--panel); border: 3px solid var(--dark); border-radius: 8px; }
.tray-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; width: min(100%, 560px); }
.tray-item { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 10px; background: var(--panel); border: 3px solid var(--dark); border-radius: 8px; }
.tray-thumb { width: 64px; height: 64px; object-fit: contain; image-rendering: pixelated; }
.tray-name { flex: 1 1 8em; font-weight: 700; }
.stepper { display: flex; align-items: center; gap: 8px; }
.stepper .btn { padding: 4px 12px; }
.stepper output { min-width: 2ch; text-align: center; font-weight: 700; }
.sheet-preview { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.sheet-mini { position: relative; width: 90px; background: #fff; border: 2px solid var(--dark); }
.sheet-mini span { position: absolute; background: #c9c9c9; outline: 1px solid #7a7a7a; }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/screens/Tray.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/Tray.tsx src/screens/Tray.test.tsx src/App.tsx src/index.css
git commit -m "feat: add print tray screen and header tray button"
```

---

### Task 7: Browser verification

**Files:** none committed (scratchpad scripts only), unless a defect is found — then fix with a failing test first, in the task that owns the code, and commit `fix: …`.

- [ ] **Step 1:** `npm run build` — Expected: success. Start `npm run dev -- --port 5199 --strictPort` in the background.
- [ ] **Step 2:** With the scratchpad CDP driver (`shot.mjs`, `helpers.js`): upload a test image for ticket, stamp, trading and tarot, Add to tray each (ticket copies 2), open the tray, screenshot at 1366 and 375 px (no horizontal scroll: `document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 3:** Use CDP `Page.printToPDF` (with `preferCSSPageSize: true`) on the tray screen for A4 and Letter (switch via operator settings `localStorage` + reload is not possible because the tray is memory only — switch via `useOperator` through the operator panel UI instead). Expected: page count matches the tray's "N pages"; no trailing blank page; cards visible with cut marks. Convert one page to PNG and inspect.
- [ ] **Step 4:** Editor: Copies = Fill page → printToPDF → exactly 1 page.
- [ ] **Step 5:** Measure real size: in the PDF, the ticket image width in points ÷ 72 × 25.4 ≈ 144 mm (±1 mm).
- [ ] **Step 6:** Stop the dev server.
