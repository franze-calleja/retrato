# Card Detail Pass, Round 1 — Design Spec

Date: 2026-10-15
Status: Approved in brainstorming, pending written-spec review
Builds on: `2026-10-13-pixel-booth-design.md`, `2026-10-13-card-editions-design.md`

## Purpose

Bring the cards up to the detail level of the booth camera. Round 1 adds a larger heading font and shared pixel-detail helpers, then redraws **Stamp, Ticket and Voucher**. Rounds 2–3 (ID, Trading, Tarot; Jester, Planet, packs, plus a colour-scheme pass using the user's mood references) reuse these tools and get their own specs.

### Success criteria

1. A 5×7 pixel font (A–Z, 0–9, common punctuation, ¢ ★ ♥ №) draws headings and names; long text falls back to the 3×5 font automatically and never overflows its slot.
2. Shared helpers draw bevels, dithered textures, corner ornaments, guilloche line patterns, rings/postmarks and vertical text, all on the art-pixel grid (crisp when upscaled).
3. Stamp, Ticket and Voucher are redrawn to the layouts below; each passes the existing template rules (photo inside the art, badge clear of the photo, missing values tolerated, print proportions exact).
4. Print sizes in mm and art sizes are unchanged; the photo stays smooth; editions still apply to frame pixels only.
5. The Ticket gains an optional **Seat** field (default `ROW A SEAT 07`, max 14).
6. No real brand names, logos or copied card art.

## Scope

**In:** big font, detail helpers, Stamp/Ticket/Voucher redraws, Ticket seat field, before/after screenshots for approval.

**Out:** other cards, packs, colour-scheme changes for other cards (later rounds), new card types.

## Big font (`src/templates/pixelFontLarge.ts`)

- `BIG_GLYPHS`: 5 columns × 7 rows bitmaps for A–Z, 0–9, `. , - ! ? ' & / : # ¢ ★ ♥ №` and space; unknown characters draw as `?`. Letters uppercase per character the same way as the 3×5 font (ß/ﬁ take one slot).
- Advance 6 px (5 + 1 gap). `measureBig(text, scale)`, `drawBig(ctx, text, x, y, color, scale, shadow?)`, `drawBigCentered(...)`.
- `drawTitle(ctx, text, cx, y, maxWidth, color, shadow?, maxScale = 2) → { font: 'big' | 'small'; scale: number; width: number }`: tries big font at `maxScale…1`, then the 3×5 font at scale 1; draws the first that fits `maxWidth`, centred, vertically centred on a 14 px line (`y` = top of the line); if nothing fits it draws the 3×5 font at scale 1 truncated to fit. Returns what it drew (for tests).

## Detail helpers (`src/templates/detail.ts`)

All take art-pixel coordinates and draw with `fill` (so editions/overlays treat them as frame pixels).

- `bevel(ctx, rect, light, dark)`: 1 px light line on top and left inside the rect, dark on bottom and right.
- `dither(ctx, rect, color, density, seed)`: deterministic hash-based speckle (same output for the same inputs), `density` 0–1.
- `hatch(ctx, rect, color, step)`: engraved line pattern (horizontal lines every `step` px).
- `cornerOrnaments(ctx, rect, color)`: a 5×5 flourish bitmap in each inner corner, mirrored.
- `guilloche(ctx, rect, color, period, amplitude)`: two interleaved sine-wave 1 px lines repeated vertically every 4 px (banknote-style pattern), clipped to the rect.
- `ring(ctx, cx, cy, r, color)`: 1 px pixel circle outline (midpoint algorithm).
- `postmark(ctx, cx, cy, r, color)`: two concentric rings plus three wavy cancel lines to their left.
- `drawTextVertical(ctx, text, x, y, color, font: 'big' | 'small', shadow?)`: text rotated 90° counter-clockwise (reads bottom to top), via exact quarter-turn transforms so pixels stay crisp.

## Card layouts (art sizes unchanged)

### Stamp (96 × 120)
- Red body with **engraved hatching** (dark-red lines every 2 px) and a **bevel**; perforations keep their notches and gain a 1 px shadow inside each notch.
- Photo window grows to `{ x: 10, y: 10, w: 76, h: 82 }` with a cream mat and dark keyline.
- Bottom band: title via `drawTitle` (max width 76); `PIXEL POST` small; **value in the big font** on a gold plate bottom-right.
- **Postmark** ring overlapping the top-right corner of the frame (outside the photo window), dark red at partial coverage.
- Edition badge stays top-left (default).

### Ticket (188 × 76)
- Gold body with a **guilloche** pattern (gold-dark) behind the text column and a bevel.
- `ADMIT ONE` in the **big font** on a red ribbon (with notched ends) across the top of the text column.
- Event name via `drawTitle` in the red panel; date small; **Seat** line (`values.seat`) small under the date; `PIXEL BOOTH` small.
- Stub: perforated tear line (dashed + notches) as today; `ADMIT ONE` small at the top; the **serial printed vertically** in the big font down the stub (falls back to the small font if it does not fit), replacing the stacked serial lines.
- Photo window unchanged; badge stays bottom of the stub.

### Voucher (188 × 92)
- Blue body with a **double border** (cream outer keyline, gold inner keyline) and **corner ornaments**; dithered linen texture on the body.
- Title via `drawTitle` (big font); **amount** in a large gold value plate (big font, scale 2 when it fits); `VALID UNTIL` small label above the expiry value.
- Stub: tear line as today; a round **seal** (ring + star + `PIXEL BOOTH` as two short lines) replacing `KEEP ♥ THIS`.
- Photo window unchanged; badge stays top of the stub.

## Fields

- Ticket adds `{ key: 'seat', label: 'Seat', default: 'ROW A SEAT 07', maxLength: 14 }` after Date.
- Remembered values that predate the field get the default: `selectTemplate` and pack deals merge `{ ...defaults, ...saved }` (so new fields appear without losing edits).

## Error handling

- Missing/empty values render nothing for that slot.
- Over-long text never overflows (`drawTitle` fallback chain; vertical serial falls back to small font then truncates).
- Unknown glyphs draw `?`.

## Testing

**Unit:**
- Big font: every glyph is 7 rows × 5 binary columns; covers A–Z, 0–9 and the listed punctuation; `measureBig` = `(n × 6 − 1) × scale`; ß/ﬁ one slot.
- `drawTitle`: picks big scale 2 when it fits, steps down to big 1, then small 2/1, then truncates; never returns `width > maxWidth`.
- Helpers: `dither` deterministic (same `fillRect` calls for the same seed, different for another seed); `ring` pixels lie at distance `r ± 0.5`; `guilloche` and all helpers draw only inside their rect; `drawTextVertical` produces the same pixel count as horizontal text.
- Templates (existing rules still pass); stamp photo rect is the new one; print sizes equal the previous values (stamp 50 × 62.1, voucher 120 × 59.7, ticket 144 × 59.6 mm); ticket has the seat field; old remembered ticket values gain the seat default.
- Edition composition still leaves photo pixels untouched (existing composeStamp tests).

**Manual:** before/after PNG renders of the three cards at export scale (common and holo editions) for the user to approve; download one PNG of each; print preview of a stamp.
