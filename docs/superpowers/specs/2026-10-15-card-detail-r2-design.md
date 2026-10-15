# Card Detail Pass, Round 2 — Design Spec

Date: 2026-10-15
Status: Approved in brainstorming, pending written-spec review
Builds on: `2026-10-15-card-detail-r1-design.md` (big font, detail helpers)

## Purpose

Redraw the **ID card**, **Trading card** and **Tarot card** at the new detail level, using Round 1's 5×7 font and helpers. The tarot moves to a sepia palette inspired by the user's references (mood only — no copied art). The ID card gains a faded **ghost photo**, which needs one small composer addition.

### Success criteria

1. All three cards are redrawn to the layouts below; art sizes, print sizes, photo windows and photo shapes are unchanged.
2. The ID card shows a small, faded, greyscale copy of the photo in a `ghostRect`; the main photo is untouched and downloads/prints include the ghost.
3. The trading card gains a **Card no.** field (`№ 042/100` style, rolled per capture, editable).
4. Every text slot fits its worst-case input (field `maxLength` of wide letters, emoji, ß) inside its own slot; no detail paints inside a photo window; no transparent holes inside card bodies.
5. Before/after renders (common + holo) approved by the user before merge.
6. No real brand names or copied card art.

## Shared additions

- **`ghostRect?: Rect`** on `Template`. `composeStamp` draws, after the main photo, a cover-cropped copy of the photo into `ghostRect × scale` with `globalAlpha = 0.35` and `filter = 'grayscale(1)'` (restored afterwards), smooth like the main photo. Editions are unaffected (they act on frame art before photos are drawn). Missing `ghostRect` → nothing.
- **`titleFit(text, maxWidth, maxScale = 2)`** in `pixelFontLarge.ts`: the pure sizing step of `drawTitle` (returns `{ font, scale, width, text }` — `text` truncated if needed); `drawTitle` uses it. Lets left-aligned slots compute width before drawing.
- New colours: `SEPIA_LIGHT [240,226,190]`, `SEPIA_MID [196,160,104]`, `SEPIA_DARK [120,84,46]`, `SEPIA_INK [62,40,22]`, `PURPLE_LIGHT [160,116,232]`, `SILVER*` reused from the camera.

## ID card (160 × 101)

- Red header (y 1–19) with the organisation via `drawTitle` (max width 140, big scale 2 when it fits).
- Cream body with a light **guilloche** (`CREAM_DARK`) behind the right column (x 58–157, y 21–98).
- Photo window unchanged `{ x: 8, y: 26, w: 48, h: 60 }` with its dark keyline.
- **Chip**: gold 18×14 at (132, 24) with contact lines and a bevel.
- Right column (x 64–128): `MEMBER` label; **name** via `titleFit` (max width 64, big scale 1 max), left-aligned; member no. (small); `VALID UNTIL` label; valid date.
- **Barcode** narrowed to 64 px wide at (64, 84).
- **Ghost photo**: `ghostRect = { x: 136, y: 70, w: 16, h: 20 }` with a 1 px `CREAM_DARK` keyline around it.
- **Hologram patch**: 22×9 at (8, 89) below the photo — silver base with diagonal `SILVER_LIGHT`/`SILVER_DARK` stripes and dither (editions shimmer it like any frame pixel).
- **Micro-text line**: a 1 px dotted security line at y 97 from x 34 to 156 (alternating 1-on/1-off with a 2-px gap every 7, reads as tiny print).
- Badge stays top-left (over the header).

## Trading card (96 × 134)

- Purple body with a **bevel** (`PURPLE_LIGHT` / `PURPLE_DARK`) and light **dither** (`PURPLE_DARK`, density 0.06).
- **Rivets**: 2×2 gold dots with a light pixel at the four outer corners of the photo mat.
- Gold name banner (unchanged position) with the name via `drawTitle` (max width 84, big scale 1).
- Photo window and mat unchanged.
- **Type ribbon**: dark-purple band (12, 88)–(84, 98) with notched ends filled in the body colour (never cleared), type text centred in cream (small font; max 16 chars = 63 px).
- **Stats box** (6, 100)–(90, 129): rows at y 103 / 110 / 117 — label, 9 pips (3×5 cells; filled gold with a light top pixel, empty dark), value right-aligned; **Card no.** right-aligned at y 123 in gold-dark.
- New field `{ key: 'number', label: 'Card no.', default: () => randomCardNo(), maxLength: 9, perCapture: true }` → `№ 042/100` (`randomCardNo(rand)` = `№ ` + 3-digit 001–100 + `/100`).
- Badge stays bottom-left over the stats box corner (clear of the number on the right).

## Tarot card (84 × 144) — sepia

- Palette: `SEPIA_LIGHT` body, `SEPIA_INK` outline, `SEPIA_MID` halftone **dither** (density 0.16) over the inner body, double border (`SEPIA_DARK` at inset 3, `SEPIA_MID` at inset 5).
- **Numeral tab**: `SEPIA_INK` / `SEPIA_LIGHT` plate at the top centre (only when the title is a known arcana, as today).
- **Arch**: `SEPIA_MID` mat (grow 3) and `SEPIA_INK` rim (grow 1); photo stays full colour, clipped to the arch as today.
- **Spandrels**: a 5×5 star at (11, 24) and a 5×5 crescent moon at (68, 24), both `SEPIA_DARK`, outside the arch.
- **Title plate**: `SEPIA_INK` / `SEPIA_LIGHT` at (6, 116)–(78, 132), title via `drawTitle` (max width 68, big scale 1) in `SEPIA_INK`; `PIXEL TAROT` small in `SEPIA_DARK` at y 134.
- Badge stays top-left (default).

## Error handling

- Missing values render nothing in that slot; long text falls back via `drawTitle`/`titleFit`.
- Templates without `ghostRect` compose exactly as before.

## Testing

**Unit:**
- `composeStamp`: with `ghostRect`, a second `drawImage` of the photo lands at `ghostRect × scale` after the main photo, with alpha 0.35 and a greyscale filter, and the context state is restored; without it, unchanged.
- `titleFit` matches what `drawTitle` draws; truncation returns the truncated text.
- Per card: photo rect, shape and print size unchanged; no detail `fillRect` inside the photo window (excluding card-wide background fills); no interior `clearRect` (no holes); every text slot stays within its own bounds for worst-case inputs (14×`W` names, 16-char types, 18-char titles, emoji, ß).
- ID: ghost rect clear of photo, text column and barcode; badge clear of photo.
- Trading: `randomCardNo` format and range; the number field exists, is per-capture, and fits its slot.
- Tarot: only sepia colours are used for frame fills (spy `fillStyle` values against the sepia set + edition-free render).

**Manual:** before/after PNGs (common + holo) of all three for user approval; a download of the ID card shows the ghost.
