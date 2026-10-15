# Card Detail Pass, Round 3 — Design Spec

Date: 2026-10-15
Status: Approved in brainstorming, pending written-spec review
Builds on: `2026-10-15-card-detail-r1-design.md`, `2026-10-15-card-detail-r2-design.md`

## Purpose

Finish the detail pass: turn the Jester card into a **Joker** card with several layouts (classic themes and a full-art layout) and a **Layout picker**, redraw the **Planet** card in teal, and give the four **packs** illustrated wrappers. Mood references (tarot/planet/joker screenshots) inform palette and layout only — no copied art, symbols or wording beyond the generic playing-card word "JOKER".

### Success criteria

1. The Jester card is shown as **Joker Card** everywhere (shop, booth, editor, packs), default name `JOKER`; its internal id stays `jester`.
2. Each Joker capture rolls a layout — `fullart` ~25 %, otherwise one of four classic themes (sunburst, stripes, starfield, halftone) — and the editor shows a **Layout** select to switch it; switching never over-crops the photo.
3. Classic layouts: white card, vertical `JOKER` corner indices (top-left reading down, bottom-right rotated 180°), a bold themed panel behind the photo, name plate and effect text.
4. Full-art layout: the photo fills the card inside a thin white border; corner index plates and a name/effect banner are drawn **over** the photo (overlay layer), crisp, with edition shimmer; the edition badge sits on top.
5. Planet card in teal: instrument-panel header with our own indicator pattern, white pill name label, sparse stars, round photo with an orbit ring, footer with level pips, grille stripes and the cosmic stat.
6. Packs: per-pack illustration (Classic fanned cards, Arcana sepia sun, Cosmic teal ringed planet, Joker jester hat with bells), foil crinkle shading, highlighted crimps, pack name in the big font; Jester Pack → **Joker Pack**; Arcana → sepia palette, Cosmic → teal palette.
7. Art sizes and print sizes unchanged; every other card unaffected; no transparent holes; text fits its slots; before/after renders approved by the user.

## Engine additions

### Template variants (`src/templates/resolve.ts`)

- `Template.variant?(values): Partial<Pick<Template, 'photoRect' | 'photoShape' | 'badgeAt' | 'ghostRect' | 'render' | 'overlay'>>`.
- `resolveTemplate(t, values): Template` returns `{ ...t, ...t.variant?.(values) }`, memoised per template id + variant result key so identities stay stable between frames.
- Consumers use the resolved template: `composeStamp` (resolves internally), Booth (side/rear screen crop), Editor (nothing else needed — it composes).
- Captures for templates with a `variant` are kept **uncropped** (the frozen, ≤1600 px frame, like pack captures) so any layout can cover-crop from the full frame; templates without variants keep today's crop.

### Overlay layer

- `Template.overlay?(ctx, values)`: art drawn at art scale **after** the photo, upscaled nearest-neighbour like the frame art, cached the same way (key = values + edition + angle).
- Editions apply to the overlay too (shimmer masked to its opaque pixels). The edition **badge** is drawn on the overlay when a template has one (so the photo never hides it), otherwise on the frame as today: `applyEdition(..., { badge: boolean })`.
- The ghost photo (Round 2) is drawn before the overlay.

### Field options → select

- `TemplateField.options?: readonly { value: string; label: string }[]`. The editor renders such fields as a `<select>` (same label, same `setValue`); text fields stay inputs.
- Values outside the options fall back to the first option when resolving the variant.

### Vertical text direction

- `drawTextVertical(..., dir: 'up' | 'down' = 'up')`: `down` reads top to bottom (exact quarter turn the other way: local (u, v) → (x − v, y + u), so the column lies left of `x`).

## Joker card (96 × 132), id `jester`

- Name `Joker Card`, description `Playing-card joker · a random silly effect`, fields: name (default `JOKER`, 12), effect (unchanged list, 36, per-capture), **layout** (options below, per-capture, default `rollJokerLayout()`).
- `JOKER_LAYOUTS`: `sunburst` "Sunburst", `stripes` "Stripes", `stars` "Starfield", `halftone` "Halftone", `fullart` "Full art". `rollJokerLayout(rand)`: `rand() < 0.25 → fullart`, else one of the four classic themes uniformly.
- **Classic** (photo `{ x: 18, y: 16, w: 60, h: 64 }`, badge top-right `{ x: 95, y: 0, align: 'right' }`):
  - White card (`CARD_WHITE [250, 247, 240]`) with dark outline and a 1 px grey inner keyline.
  - Corner indices: `JOKER` in the 3×5 font, vertical — top-left at x 3–7 reading down, bottom-right at x 88–92 rotated 180° (reading up, upside down).
  - Themed panel `{ x: 10, y: 8, w: 76, h: 80 }` behind the photo mat: **sunburst** (alternating 16 ray sectors `RED`/`GOLD` from the centre), **stripes** (diagonal 4 px `BLUE`/`CREAM` bands), **stars** (`NAVY` with `GOLD`/`CREAM` star dots), **halftone** (`PURPLE` with a dot grid growing toward the bottom in `PINK [242, 120, 170]`).
  - Photo: cream mat + dark keyline. Name plate at y 92 (big font, max 76). Effect: up to 2 wrapped lines, small font, y 108 / 116, dark on white.
- **Full art** (photo `{ x: 4, y: 4, w: 88, h: 124 }`, badge top-right):
  - Frame: white border + outline (the photo covers the rest).
  - Overlay: white rounded corner plates with the vertical `JOKER` index (top-left, bottom-right rotated); a banner `{ x: 6, y: 100, w: 84, h: 24 }` (dark outline, white fill at full opacity) with the name (big font, max 78) and the effect on one line (small font, truncated to 78 px).
- Missing/unknown layout → `sunburst`.

## Planet card (96 × 132) — teal

- Colours: `TEAL [92, 172, 178]`, `TEAL_LIGHT [168, 222, 222]`, `TEAL_DARK [36, 96, 108]`, `TEAL_INK [18, 52, 62]`, `CARD_WHITE`.
- Body `TEAL` with `TEAL_INK` outline, rounded corners (r 4), a bevel (`TEAL_LIGHT`/`TEAL_DARK`).
- Header strip `{ x: 6, y: 5, w: 84, h: 9 }` `TEAL_DARK` with an indicator row: 2 small lights, a pill toggle, 3 dots, a ring light (our own pattern) in `TEAL_LIGHT`/`CREAM`.
- Name pill `{ x: 14, y: 17, w: 68, h: 13 }` white with `TEAL_INK` outline, planet name in the big font (max 64).
- Sparse star speckles (`TEAL_LIGHT`, `CREAM`) over the body.
- Photo: round, `{ x: 22, y: 34, w: 52, h: 52 }`, `TEAL_LIGHT` mat + `TEAL_INK` rim, orbit ring (ellipse 40 × 12) passing behind.
- Footer panel `{ x: 8, y: 94, w: 80, h: 32 }` `TEAL_DARK`: cosmic stat (small, `CREAM`), 5 level pips (filled count from the first digit in the stat, else 3), grille stripes along the bottom.
- `PIXEL COSMOS` dropped (space taken by the footer).

## Packs (64 × 88 art, unchanged size)

- `PackArt` gains `illustration: { rows: readonly string[]; palette: readonly Color[] }` (palette-indexed rows, `0` = transparent) replacing `emblem`/`emblemColor`.
- Wrapper: body + diagonal stripe pattern as today, plus **foil crinkle** (deterministic light dither streaks), crimp highlights (1 px light on each crimp tooth), label plate with the pack's first word (3×5) over **PACK** (big font), the illustration (~24 × 18) centred below, `PICK 1 OF 3` as today.
- Palettes/illustrations: Classic (purple body; three fanned cards red/gold/cream), Arcana (sepia body; radiant sun gold/sepia), Cosmic (teal body; ringed planet teal/cream), Joker (red body; jester hat red/gold with bells). Names: `Classic Pack`, `Arcana Pack`, `Cosmic Pack`, `Joker Pack` (description wording updated to "Joker").

## Error handling

- Unknown layout value → first option (`sunburst`); editor select always shows a valid option.
- Templates without `variant`/`overlay`/`options` behave exactly as before.
- Long names/effects fall back via `drawTitle`/`titleFit`/`wrapText`; full-art effect truncates to one line.

## Testing

**Unit:**
- `resolveTemplate`: no variant → same object; variant overrides; memoised identity for equal inputs.
- `composeStamp`: overlay drawn after the photo (and after the ghost), upscaled; badge on the overlay when present, on the frame otherwise; overlay edition shimmer applied; cache reuse.
- Editor: a field with `options` renders a select; choosing an option calls `setValue`; Joker layout select lists the five layouts.
- Booth/store: a Joker capture keeps the uncropped frame (`capture.w` = frozen width); other cards still crop.
- `drawTextVertical` `down`: transform `(0, 1, −1, 0, x, y)`.
- Joker: `rollJokerLayout` distribution boundaries; each layout's photo rect/badge; classic themes draw only inside the theme panel and not inside the photo; full-art overlay stays outside the centre of the photo except the plates and banner; no holes; long name/effect fit; unknown layout → sunburst.
- Planet: teal palette only (fillStyle spy + `SHADOW`, `CARD_WHITE`, `CREAM`); round photo rect; text fits; no holes.
- Packs: each pack has an illustration with a valid palette; illustration drawn inside the wrapper; names updated (`Joker Pack`); pack art size unchanged.
- Rename: shop/booth show `Joker Card`; no user-visible "Jester" remains (grep test on template/pack names and descriptions).

**Manual:** before/after renders (common + holo) of Joker (each layout), Planet and the four packs; editor layout switch on a real capture; full-art download.
