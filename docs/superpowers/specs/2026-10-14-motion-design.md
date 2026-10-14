# Motion: Pack Opening, Living Shelf, Card Glare — Design Spec

Date: 2026-10-14
Status: Approved in brainstorming, pending written-spec review
Builds on: `2026-10-14-shop-and-packs-design.md`, `2026-10-13-card-editions-design.md`

## Purpose

Make the booth feel more alive in the three places guests spend their attention: opening a pack, browsing the shop, and admiring the finished card. All motion is display-only (downloads and prints are unchanged) and all of it is off under `prefers-reduced-motion`.

### Success criteria

1. In pack mode, after capture the guest sees the sealed pack; a tap/click/Enter/Space (or 3 s of waiting) shakes it, tears the top strip off, and the three cards slide out and fan into place before the existing flip-and-pick.
2. A pack holding a Holographic or Polychrome card glows in that edition's colour while it shakes.
3. Any key or tap during the opening skips straight to the face-down cards; the existing deal flow then runs unchanged.
4. On the shop, a shine sweeps across one card at a time every few seconds; hover/focus lifts cards with a growing shadow; packs sway and rustle on hover; Reroll spins the featured cards out and the new ones in.
5. In the editor, a soft glare follows the pointer and the drop shadow shifts with tilt; Foil/Holo/Poly get silver/rainbow/rainbow+sparkle glare. The glare never covers the photo window.
6. Reduced motion: no pack step (straight to the face-up deal), no shelf glints/sway/spins, no glare.

## Scope

**In:** pack-opening phase and its hook, pack art split, shelf glints/lift/sway/reroll spin, editor glare + shadow, reduced-motion handling, tests.

**Out:** sound, new art for packs or cards, motion in downloads/prints, changes to the booth/countdown, deck-pile animation.

## 1. Pack opening

### Phases (`usePackOpen(rareTint, reducedMotion)` in `src/screens/usePackOpen.ts`)

`sealed` → `shake` → `tear` → `burst` → `done`.

| phase | duration | what shows |
|---|---|---|
| `sealed` | until tap or `AUTO_OPEN` = 3000 ms | big pack, gentle wiggle, "Tap to open" |
| `shake` | 350 ms | pack shakes; rare glow if `rareTint` |
| `tear` | 400 ms | top strip flies up and spins away; body stays |
| `burst` | 600 ms | pixel flash at the opening; cards slide up out of the pack and fan to their deal positions; pack drops and fades |
| `done` | — | existing `useDeal` flip sequence starts |

- `OPEN_TIMING = { auto: 3000, shake: 350, tear: 400, burst: 600 }`.
- `open()` from `sealed` starts `shake`; ignored in other phases.
- `skip()` from any phase before `done` jumps to `done`. Any key or a tap on the stage calls `open()` while `sealed` and `skip()` after it.
- Reduced motion starts at `done`.
- The hook returns `{ phase, open, skip }`.

### PackDeal integration

- `PackDeal` renders the opening stage while `phase !== 'done'` and the existing deal once `done`. `useDeal` starts counting only once `done` (its timers would otherwise run behind the stage): `PackDeal` mounts the deal (and so `useDeal`) at `done`.
- The heading reads "Open your pack" during the opening and "Pick one to keep" after; focus moves to the heading on mount (unchanged behaviour).
- The stage is a `<button className="pack-stage">` labelled "Open the {pack name}" while sealed, so keyboard users can open it; its hint text is "Tap to open".
- The burst's card slide-out is the existing `.deal-card` entrance animation replaced, only when coming from the stage, by a `from-pack` variant: cards start at the pack's position (translate up from below, scaled down) and fan to place, staggered 90 ms.
- Rare tint: `rareTint` = the colour of the rarest edition among the dealt cards (Polychrome > Holographic), or `null`. Colours: Holographic `#7fd6ff`, Polychrome `#ff7fe1`. Applied as a CSS `drop-shadow` glow via a `--glow` custom property during `shake`.

### Pack art split

- `packArtParts(pack, scale) → { top: HTMLCanvasElement; body: HTMLCanvasElement }` in `src/packs/packArt.ts`.
- `TEAR_ROW = 9` art pixels: `top` = rows `0..TEAR_ROW-1` of the full art (the crimped end), `body` = the rest. Both at `scale`, nearest-neighbour.
- Stacked, they reproduce the full `packArt` exactly (same width; heights add up).

## 2. Shop shelf

All CSS-driven; components only add classes, custom properties, and keys.

- **Glints:** every `.tile-btn` (cards and packs) gets a `::before` shine sweep (diagonal light band, `mix-blend-mode: screen`) running a 7 s cycle with a per-tile `--glint-delay` (index × 1.4 s), so one item shines at a time. The existing pack `::after` sheen is replaced by this shared glint.
- **Lift:** hover/focus on a card tile: `translateY(-8px) scale(1.06)` and a larger, softer drop shadow (two-step `drop-shadow`), 160 ms ease-out.
- **Packs:** the pack's `TiltCard` uses a `sway` animation (rotate ±2°, 4 s) instead of the card `bob`; hover/focus plays a 400 ms `rustle` wiggle once. `TiltCard` gains an optional `motion?: 'bob' | 'sway'` prop (default `bob`).
- **Reroll spin:** the featured shelf row gets a `key` that changes on every reroll (a counter), so new tiles mount and play `spin-in` (rotateY 90°→0°, 350 ms, staggered by index × 80 ms). Leaving tiles are not animated (instant swap keeps it simple; the incoming spin carries the motion).
- Reduced motion: glints hidden, no sway/rustle/spin, lift without transition.

## 3. Editor glare

- New `CardGlare` wrapper (`src/screens/CardGlare.tsx`) around the editor's `ShimmerCard` inside `TiltCard`.
- Pointer position over the card sets `--gx`, `--gy` (0–100 %) on the wrapper; a `.glare` overlay draws a radial highlight at that point. When the pointer leaves, the glare fades out.
- Variant by edition id, as a `data-glare` attribute: `common` (soft white, 0.18 opacity), `foil` (silver, 0.3), `holo` (rainbow conic band, 0.3, `mix-blend-mode: color-dodge`), `poly` (rainbow + 6 small twinkling sparkle dots, 0.3).
- **Photo hole:** the overlay is clipped with `clip-path: path(evenodd, …)` = the card rectangle minus the template's `photoRect` (as percentages of `template.size`), via `glareClip(template) → string` (pure, in `src/screens/glare.ts`). Shaped windows (arch/circle) use their bounding rect.
- **Shadow:** the wrapper's `filter: drop-shadow(...)` offset follows tilt: `x = -ry/2 px`, `y = 8 + rx/2 px`, using the `--rx/--ry` already set by `TiltCard` (CSS `calc`).
- Not rendered under reduced motion (no glare element, static shadow).
- Display only: export/print code paths untouched.

## Error handling

- Unknown edition id → `common` glare.
- A pack with no rare card → no glow.
- If the stage is skipped mid-animation, the deal starts cleanly (no leftover timers: every phase timer is cleared on phase change/unmount).
- Back to shop during the opening cancels everything (component unmounts).

## Testing

**Unit:**
- `usePackOpen`: starts `sealed`; auto-opens after 3000 ms; `open()` walks shake → tear → burst → done on the timings; `open()` is ignored once opening; `skip()` jumps to `done` from every phase; reduced motion starts at `done`; timers cleared on unmount.
- `packArtParts`: widths equal the full art; heights sum to the full art; `top` + `body` pixels match `packArt` (compare `getImageData` via the canvas mock's recorded calls or by drawing both into one canvas and checking `drawImage` arguments).
- `PackDeal`: shows "Open your pack" and the stage first; Enter/click opens; after the timings the three deal cards appear and the flip proceeds; a key during `tear` skips to the cards; reduced motion shows the face-up deal immediately; rare tint set on the stage when a holo/poly card is dealt.
- Shop: reroll changes the featured row's key (new tiles mount with `spin-in` class); pack tiles use `sway`.
- `glareClip`: for every template the hole matches `photoRect` as percentages; output is a valid `path(evenodd, ...)` string.
- `CardGlare`: pointer move sets `--gx/--gy`; `data-glare` matches the edition (unknown → common); not rendered with reduced motion.
- Styles: reduced-motion block disables the new animations (`.tile-btn::before`, `.pack-stage`, `.spin-in`, `.glare`).

**Manual (Chrome):** screenshots mid-shake, mid-tear, mid-burst; full pack flow with a forced Polychrome (glow visible); shop at 1366 and 375 px (no horizontal scroll, glints stagger); reroll spin; editor glare over each edition, photo window unglared; reduced motion end-to-end.
