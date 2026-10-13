# Card Editions & Reveal — Design Spec

Date: 2026-10-13
Status: Approved in brainstorming, pending written-spec review
Builds on: `2026-10-13-pixel-booth-design.md`

## Purpose

Make every capture feel like drawing a card. Each capture rolls a random **edition** (Common, Foil, Holographic, Polychrome) that adds a pixel-art shimmer to the frame, and the result is shown with a **card-flip reveal**. Event operators can tune the odds or force an edition from a hidden panel.

### Success criteria

1. Every capture gets an edition rolled from the operator's odds (or the forced edition). Retake rolls again; editing text keeps the edition.
2. The edition effect touches only frame pixels — the photo stays pixel-identical to the non-edition output.
3. On screen the shimmer follows the pointer/tilt and drifts slowly when idle; download and print contain a frozen snapshot at a fixed angle plus the edition badge.
4. After capture, the editor shows a card back that flips to reveal the card; rare editions (Holo, Polychrome) get a banner and sparkle burst. Click skips. Reduced motion shows the card immediately.
5. Operator settings persist on the device; if storage is unavailable, defaults apply and nothing breaks.
6. Adding an edition = one module + one registry line.

## Scope

**In:** four editions, edition roll, frame-only effects, badges, card back + flip reveal + banner, live shimmer in the editor, operator panel (odds, force, reset), persistence.

**Out (later):** animated GIF/video export, print sheets, editions shown in the booth preview (the booth stays Common so the edition is a surprise), per-template edition art.

## Editions

| id | Name | Default weight | Look | Badge | Rare |
|---|---|---|---|---|---|
| `common` | Common | 60 | no effect | — | no |
| `foil` | Foil | 25 | silvery diagonal light band sweeping with angle | `★ FOIL` | no |
| `holo` | Holographic | 12 | banded rainbow diagonal stripes shifting with angle | `★ HOLO` | yes |
| `poly` | Polychrome | 3 | stronger hue-shifting rainbow + twinkling sparkle pixels | `★★ POLY` | yes |

Effects are computed at **art-pixel resolution** (so the shine is itself pixelated) with colors quantized to a few levels.

## Rendering

- `Edition` interface: `{ id, name, defaultWeight, badge?: string, rare: boolean, overlay(w, h, angle) → ImageData | null }`. `angle` is a number in `[0, 1)`.
- `composeStamp(template, photo, values, scale, target?, opts?)` gains `opts: { edition?: Edition; angle?: number }`:
  1. render frame art (as today);
  2. if the edition has an overlay, draw it onto the art with `globalCompositeOperation = 'source-atop'` (only opaque frame pixels change);
  3. draw the badge (if any) as a small pixel sticker at the art's top-left;
  4. upscale (nearest) and draw the photo on top (smooth) — unchanged, so the photo is never affected.
- The frame-art cache key includes edition id and angle; angles are quantized to 64 steps so the live shimmer hits the cache.
- Download and print use `SNAPSHOT_ANGLE = 0.35`.
- The badge glyphs use the existing bitmap font; `★` is added to the glyph table.

## State

- **Booth store:** adds `edition: string` (id). `setCapture` rolls a new edition using the operator settings; `retake` and template changes do not keep a stale edition (the next capture rolls). Edits to text never change it.
- **Operator store** (new, Zustand): `{ weights: Record<editionId, number>, forced: editionId | 'random' }` with `setWeight`, `setForced`, `reset`. Persisted to `localStorage` under `pixel-booth:operator` through a storage wrapper that swallows errors (private mode, quota, blocked storage) and falls back to defaults.
- **`rollEdition(settings, rand = Math.random) → editionId`:** forced wins; otherwise weighted random over non-negative weights; if all weights are 0 or invalid, returns `common`.

## Reveal (Editor)

Phases: `back` (≈250 ms) → `flip` (≈600 ms, 3D rotateY; content swaps at the halfway point) → `shown`. For rare editions a banner ("HOLOGRAPHIC!" / "POLYCHROME!") pops and a short sparkle burst plays during `shown` entry (~1.2 s).

- Card back: a generic pixel card back the size of the template's art (stepped-corner outline, red/blue diamond pattern, small "PIXEL BOOTH" mark), upscaled like the card.
- Clicking or pressing a key during `back`/`flip` jumps to `shown`.
- `prefers-reduced-motion`: start at `shown`, no banner animation, no idle drift, static `SNAPSHOT_ANGLE`.
- Live shimmer in `shown`: the card sits in a `TiltCard`; pointer position over the card sets `angle`; when the pointer is away, `angle` drifts slowly over time (requestAnimationFrame, paused when the tab is hidden).
- Fields, Download, Print, Retake, Change card stay as today; Download/Print include the edition snapshot and badge.

## Operator panel

- Opened by tapping the logo 5 times within 2 seconds, or `Shift+Alt+O`. Closed with Escape, a Close button, or clicking the backdrop.
- Modal dialog (`role="dialog"`, focus moved into it, focus returned on close) containing: one numeric slider (0–100) per edition showing its resulting percentage, a "Force edition" select (Random + each edition), and "Reset to defaults".
- Not password protected — it holds nothing sensitive.

## Error handling

- Storage read/write failures: ignored; in-memory settings still work for the session.
- Corrupt stored JSON or unknown edition ids: defaults (unknown forced id → `random`; unknown weight keys ignored; negative/NaN weights → 0).
- Missing edition id at render time: treated as Common.

## Testing

**Unit:**
- `rollEdition`: forced wins; weighted selection at boundary `rand` values; all-zero → common; negative/NaN weights treated as 0.
- Operator store: persists and restores; corrupt JSON → defaults; throwing storage → defaults with no exception.
- Booth store: capture rolls an edition from operator settings (forced makes it deterministic); text edits keep it; retake + capture rolls again.
- Editions: every overlay returns `w × h` ImageData (or null for common); every edition has a unique id; badge text renders with known glyphs (no `?`).
- `composeStamp`: photo `drawImage` happens after the edition overlay; art cache distinguishes edition and angle; angle quantization.
- Reveal: reduced motion starts at `shown`; click during `back` skips to `shown`.
- Operator panel: opens on 5 logo taps / shortcut; Escape closes and restores focus.

**Manual:** each forced edition looks right in the editor and in the downloaded PNG; photo region unchanged versus Common; reveal on desktop and phone width; reduced motion; panel settings survive reload.
