# Print Sheets — Design Spec

Date: 2026-10-14
Status: Approved in brainstorming, pending written-spec review
Builds on: `2026-10-13-pixel-booth-design.md`, `2026-10-13-card-editions-design.md`, `2026-10-14-shop-and-packs-design.md`

## Purpose

Print several cards on one page. A guest (or operator) can print copies of the card in the editor, or collect different cards in a **print tray** and print them together on as few sheets as possible, with cut marks.

### Success criteria

1. In the editor, a Copies choice (1, 2, 4, Fill page) controls how many copies Print puts on the sheet(s).
2. "Add to tray" stores the current card (frozen as rendered) with its copy count; the tray holds up to 20 entries.
3. A "Print tray (N)" button is visible on every screen while the tray has entries; it opens the tray screen without losing the current screen's state.
4. The tray screen lists entries (thumbnail, name, edition, copies stepper 1–20, Remove), previews the pages, and prints them in one go.
5. Cards print at their real size (`printSizeMm`), packed in tray order, with corner cut marks; paper is A4 or Letter (operator setting, A4 default).
6. The tray lives in memory only: nothing about it is written to storage; reload empties it.
7. Ctrl/Cmd+P on the tray screen prints the tray; the print dialog never shows a blank page because images are not yet loaded.

## Scope

**In:** layout function, print view (pages + cut marks), editor copies + Add to tray, tray store, tray screen, header tray button, paper setting, after-print clear prompt.

**Out:** PDF export, rotating cards to fit, per-card bleed, saving the tray across reloads, printing card backs.

## Layout

`packSheets(items, paper) → Page[]` in `src/print/layout.ts`, pure, all units mm.

- `PAPER = { a4: { w: 210, h: 297 }, letter: { w: 215.9, h: 279.4 } }`, `MARGIN = 10`, `GAP = 4`.
- Printable area = paper minus margins on all sides (A4 190 × 277, Letter 195.9 × 259.4).
- Input: `{ key: string; w: number; h: number }[]` — one entry per copy (the caller expands copies), in order.
- Shelf packing: place left to right; when the next card does not fit the row width, start a new row below the tallest card of the current row plus `GAP`; when the row does not fit the page height, start a new page. No rotation, no reordering.
- Output: `Page = { cards: { key, x, y, w, h }[] }` with `x, y` relative to the printable area's top-left.
- A card larger than the printable area (none today; widest is the 144 mm ticket) is placed alone on its own page at the origin and may overflow; it never loops.
- `fitCount(size, paper)` = how many copies of one card size fit on one page (used by "Fill page"); at least 1.

## Print view

`PrintSheets` (`src/print/PrintSheets.tsx`), portaled into `.app` like today's print image, hidden on screen and shown only in `@media print`.

- One `div.print-page` per page, sized to the printable area in mm, `break-after: page` (except the last).
- Each card is an absolutely positioned `<img>` at its `x, y, w, h` in mm.
- Cut marks: four thin (0.2 mm, grey) L-shaped marks of 3 mm per card, drawn just outside each corner inside the gap.
- An inline `<style>` sets `@page { size: A4 | letter; margin: 10mm }` for the chosen paper.
- `onReady` fires once every image has loaded (or immediately for zero images); callers print from there.

## Editor

- Copies select: `1`, `2`, `4`, `Fill page` (= `fitCount(template.printSizeMm, paper)`). Default 1.
- **Print**: renders the card once (EXPORT_SCALE, SNAPSHOT_ANGLE, edition), lays out that many copies, mounts `PrintSheets`, calls `window.print()` on ready. Does not touch the tray.
- **Add to tray**: renders the card to a PNG blob, adds `{ templateId, name, edition, url, size, copies }` to the tray, shows "Added to tray" (`role="status"`) briefly. Disabled with "Tray full (20)" when the tray is full. If rendering fails (no blob), shows "Couldn't add this card" and adds nothing.

## Tray store (`src/store/tray.ts`, Zustand, memory only)

- `TrayItem = { id: string; templateId: string; name: string; edition: string; url: string; size: { w: number; h: number }; copies: number }` — `url` is an object URL of the frozen PNG.
- `TRAY_MAX = 20`, `MAX_COPIES = 20`.
- State `items: TrayItem[]`, `open: boolean`.
- `add(item without id)` → returns false and does nothing when full; copies clamped to 1–20.
- `setCopies(id, n)` clamps to 1–20 (non-finite → 1). `remove(id)` revokes its URL. `clear()` revokes all URLs and empties. `show()` / `hide()` toggle `open`; `clear()` also hides.
- Never touches storage.

## Tray screen (`src/screens/Tray.tsx`)

- App renders the tray screen instead of the current screen while `open` is true; the booth store is untouched, so Back returns to exactly where the guest was (the camera restarts if they were in the booth).
- Header button "Print tray (N)" (N = total copies) next to the logo, shown on every screen while the tray has items and the tray screen is closed.
- Lists entries in order: thumbnail (`<img>`), "Name — Edition", copies stepper (− / value / +, 1–20), Remove.
- Sheet preview: one small scaled box per page with outlines of each card's position; text "N pages".
- Buttons: **Print N pages**, **Clear tray**, **Back**. Empty tray → shows "Your tray is empty" and Print is disabled.
- `PrintSheets` stays mounted with the tray's pages while the screen is open, so Ctrl/Cmd+P prints the tray too. Print button waits for `onReady`.
- After printing (`afterprint` event following our print), a banner: "Done printing?" with **Clear tray** and **Keep**.

## Paper setting

- Operator store gains `paper: 'a4' | 'letter'` (default `a4`), persisted with the other settings under `pixel-booth:operator`; unknown/corrupt → `a4`. "Reset to defaults" resets it too.
- Operator panel: a "Paper" select (A4, Letter).

## Error handling

- Tray full → Add disabled with reason. Render failure → message, nothing added.
- Empty tray → nothing to print. Copies inputs clamp, never NaN.
- Removing or clearing entries revokes object URLs (no leaks).
- Images that fail to load still count toward `onReady` so printing is never stuck.

## Testing

**Unit:**
- `packSheets`: single row; wraps to a new row; new page when height runs out; A4 vs Letter give different counts; tray order kept; oversized card gets its own page; empty input → no pages.
- `fitCount`: matches `packSheets` page-1 count for each template on both papers.
- Tray store: add, cap at 20, copies clamping, remove/clear revoke URLs, open/hide, nothing written to localStorage.
- Operator: paper persists, restores, corrupt → a4, reset → a4.
- `PrintSheets`: page count, card `<img>` sizes and positions in mm, `@page` size, `onReady` after all images load/error.
- Editor: Copies → Print lays out that many; Add to tray adds with copies; full tray disables Add.
- Tray screen: lists items, stepper, remove, clear, page count text, empty state, after-print banner.
- App: header tray button appears with items, opens tray, Back restores the previous screen.

**Manual:** Chrome print preview for A4 and Letter with a mixed tray (ticket, stamp, trading, tarot) — real-size check with a ruler on one card; Fill page; Ctrl/Cmd+P on tray screen; 375 px tray screen without horizontal scroll.
