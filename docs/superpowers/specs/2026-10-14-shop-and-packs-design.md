# Shop Homepage & Booster Pack — Design Spec

Date: 2026-10-14
Status: Approved in brainstorming, pending written-spec review
Builds on: `2026-10-13-pixel-booth-design.md`, `2026-10-13-card-editions-design.md`

## Purpose

Turn the homepage into a card-shop-style hub and add a **booster pack**: one photo, three different card types dealt face-down with their own editions, the guest picks one to keep.

### Success criteria

1. The homepage shows the five cards on a felt tray with name tags, a Packs row with the booster pack, a live Odds panel, and "How it works" — and works at 375 px wide with no horizontal scroll.
2. Every card and the pack show an info box on hover and on keyboard focus.
3. Choosing the pack runs: booth (pack viewfinder) → capture → deal 3 distinct card types, each with an edition rolled from operator odds → pick one → editor with that card already revealed.
4. Edited text is remembered per card type and used everywhere that card appears (direct pick, pack deal); per-capture fields (ticket serial, member number, stats) still roll fresh.
5. Reduced motion: the deal shows all three cards face up immediately; no tray bob/tilt.
6. Retake from a pack card deals a new pack from a new photo; Change card returns home.

## Scope

**In:** shop layout, felt tray, tags, info boxes, pixel booster-pack art, odds panel, how-it-works, pack viewfinder, pack capture, deal screen, pick, per-template remembered values, `description` on templates.

**Out:** currency, prices, rerolls, multiple pack types, print sheets (round 3).

## Homepage

```
┌───────────────────────────────────────────────────────┐
│                      PIXEL BOOTH                      │
│ ┌───────────┐ ┌─────────────────────────────────────┐ │
│ │ ODDS      │ │ CARDS              (felt-green tray)│ │
│ │ ■ Common60│ │ [Stamp] [Voucher] [Ticket]          │ │
│ │ ■ Foil  25│ │ [Trading Card] [ID Card]            │ │
│ │ ■ Holo  12│ │   gold name tag under each card     │ │
│ │ ■ Poly   3│ ├─────────────────────────────────────┤ │
│ ├───────────┤ │ PACKS                               │ │
│ │ HOW IT    │ │ [BOOSTER PACK]  pick 1 of 3         │ │
│ │ WORKS     │ └─────────────────────────────────────┘ │
│ └───────────┘                                         │
└───────────────────────────────────────────────────────┘
```

- **Tray:** dark rounded panel with a felt-green inner mat (CSS texture, no images). Cards keep `TiltCard` tilt/bob; each card is a button with a gold name tag below.
- **Info box:** a small dark panel (`role="tooltip"`, referenced by `aria-describedby`) shown on hover and focus. Cards show `template.description`; the pack shows "3 different cards from one photo, each with its own edition. Keep 1." Each template gets a one-line `description`.
- **Booster pack:** pixel art drawn on canvas (foil wrapper, crimped top and bottom edges, "BOOSTER PACK" and "PICK 1 OF 3"), with a gentle CSS sheen animation. It is a button.
- **Odds panel:** reads the operator store live; one row per edition with a color swatch, name, and percentage (same math as the operator panel; all-zero → 100% Common).
- **How it works:** three short steps — Pick a card or a pack · Strike a pose · Keep, download or print.
- **Phone (< 720 px):** single column — tray (cards two per row, scaled), packs, odds, how it works.
- The old "Pick a card" heading/picker grid is replaced by this layout.

## Booster pack flow

### Booth

- In pack mode the booth preview uses a **pack viewfinder** — a template-like frame (not in the registry, not selectable) with a 3:4 photo window and "BOOSTER PACK" lettering; countdown and upload work as today.
- **Pack capture** stores the photo uncropped: mirrored for the camera (same as the preview), scaled so its longest side is at most 1600 px, aspect preserved. Each dealt card cover-crops it via the existing composer.

### Deal

- `dealPack(settings, rand)` picks **3 distinct** template ids uniformly from the registry and rolls an edition for each with `rollEdition`.
- Each dealt card's values = the remembered values for that template (or its defaults) with per-capture fields refreshed.
- New screen `pack`: three card backs slide in (staggered ~120 ms), then flip one by one (~350 ms apart). Rare editions get a short glint on flip. Cards show their edition at `SNAPSHOT_ANGLE` (no live shimmer on this screen).
- Clicking/tapping or pressing a key while dealing reveals all cards immediately. Once revealed, each card is a button (`aria-label` like "Ticket, Holographic edition"); choosing one lifts it and fades the others (~300 ms), then opens the editor.
- Reduced motion: all three face up at once, no slide/flip/glint, pick goes straight to the editor.

### After picking

- The editor opens with the picked template, its values and edition, and **skips its own reveal** (starts at `shown`).
- Retake → booth in pack mode → new capture → new deal. Change card → homepage. Editing text updates the remembered values for that template.

## State (booth store)

- `screen`: adds `'pack'`.
- `mode: 'single' | 'pack'`.
- `saved: Record<templateId, Record<string, string>>` — remembered values per template; `setValue` writes to both `values` and `saved[templateId]`.
- `pack: { templateId: string; edition: string; values: Record<string, string> }[] | null`.
- `revealed: boolean` — true when the editor should skip its reveal (after a pack pick).
- Actions:
  - `selectTemplate(id)`: mode `single`, values = `saved[id]` ?? defaults, clears capture/edition/pack, `revealed = false`, screen `booth`.
  - `selectPack()`: mode `pack`, clears capture/edition/pack, screen `booth`.
  - `setCapture(photo)`: single → as today (edition roll, per-capture refresh, editor). Pack → stores capture, deals, screen `pack`.
  - `pickPackCard(i)`: sets templateId, values, edition from `pack[i]`; saves values; `revealed = true`; screen `editor`. Ignores out-of-range indexes.
  - `retake()`: keeps mode; clears capture/edition/pack; `revealed = false`; screen `booth`.
  - `goToPicker()`: clears capture/edition/pack; screen `picker`.

## Error handling

- Fewer than 3 templates registered: deal as many distinct cards as exist (never repeat).
- `pickPackCard` with no pack or a bad index: no-op.
- Uploads in pack mode use the same decode error path as today.
- Pack capture of a tiny image (< 1600 px): kept at its own size (never upscaled).

## Testing

**Unit:**
- `dealPack`: 3 distinct ids; deterministic with seeded `rand`; editions follow forced operator setting; registry smaller than 3 → no repeats.
- Store: per-template remembered values (select → edit → switch → switch back keeps edits; pack deal uses remembered values; per-capture fields refresh); pack capture → `pack` screen with 3 cards; `pickPackCard` sets template/values/edition and `revealed`; retake keeps pack mode; bad index no-op.
- Pack capture sizing: longest side ≤ 1600, aspect preserved, no upscaling.
- Templates: every template has a non-empty `description`.
- Homepage: odds panel percentages follow the operator store; info box appears on focus with `aria-describedby`; pack button starts pack mode.
- Deal screen: reduced motion → all cards face up and pickable immediately; a key press during dealing reveals all; choosing a card opens the editor with that template.
- Editor: `revealed` → starts at `shown`.

**Manual:** full pack flow with fake camera and upload; each dealt card crops the photo correctly (portrait and landscape cards); homepage at desktop and 375 px; reduced motion; keyboard-only pass through homepage → pack → pick.
