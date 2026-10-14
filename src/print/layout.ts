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
