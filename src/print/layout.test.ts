import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { CUT_MARK, CUT_OFFSET, GAP, INSET, cutMarks, fitCount, packSheets, printableArea, type SheetItem } from './layout'

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
  expect(page.cards.map((c) => [c.x - INSET, c.y - INSET])).toEqual([[0, 0], [54, 0], [108, 0]])
})

test('a card that does not fit the row width starts a new row below the tallest card', () => {
  const pages = packSheets([card(120, 60), card(50, 62), card(144, 60)], 'a4')
  expect(pages).toHaveLength(1)
  expect(pages[0].cards.map((c) => [c.x - INSET, c.y - INSET])).toEqual([[0, 0], [124, 0], [0, 66]])
})

test('a row that does not fit the page height starts a new page', () => {
  // 144×60 tickets: one per row, rows at 0, 64, 128, 192 (ends 252 ≤ 277); fifth needs 256+60 > 277.
  const pages = packSheets(many(5, 144, 60), 'a4')
  expect(pages.map((p) => p.cards.length)).toEqual([4, 1])
  expect(pages[1].cards[0]).toMatchObject({ x: INSET, y: INSET, src: 'c4' })
})

test('tray order is kept', () => {
  const pages = packSheets(many(7, 63, 88), 'a4')
  expect(pages.flatMap((p) => p.cards.map((c) => c.src))).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'])
})

test('A4 and Letter can need different page counts', () => {
  // A4 fits 4 rows of 62 mm cards (260 ≤ 270 after the inset); Letter (252.4) fits only 3.
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
  expect(pages.map((p) => p.cards.map((c) => [c.w, c.x, c.y]))).toEqual([[[50, INSET, INSET]], [[300, INSET, INSET]], [[50, INSET, INSET]]])
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

test('cut marks stay inside the printable area, even on a nearly full page', () => {
  // Letter: a ticket then 9 stamps fills rows down to within 3.5 mm of the bottom.
  for (const paper of ['a4', 'letter'] as const) {
    const area = printableArea(paper)
    const trays = [[card(144, 60), ...many(9, 50, 62)], ...templates.map((t) => many(30, t.printSizeMm.w, t.printSizeMm.h))]
    for (const items of trays)
      for (const page of packSheets(items, paper))
        for (const m of page.cards.flatMap(cutMarks)) {
          expect(m.x).toBeGreaterThanOrEqual(-1e-6)
          expect(m.y).toBeGreaterThanOrEqual(-1e-6)
          expect(m.x + m.w).toBeLessThanOrEqual(area.w + 1e-6)
          expect(m.y + m.h).toBeLessThanOrEqual(area.h + 1e-6)
        }
  }
})
