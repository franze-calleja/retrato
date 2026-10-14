# Instant Camera Booth — Design Spec

Date: 2026-10-14
Status: Approved in brainstorming, pending written-spec review
Builds on: `2026-10-13-pixel-booth-design.md`, `2026-10-14-shop-and-packs-design.md`, `2026-10-14-motion-design.md`

## Purpose

Replace the card-frame preview on the booth screen with a pixel-art **instant camera** (inspired by a brown retro hybrid instant camera — silver body, brown pebbled leather, big ringed lens), and turn each capture into an **instant print** that ejects, develops, and becomes the card or goes into the pack.

### Success criteria

1. The booth shows the camera front by default, with a small hinged **side screen** showing the live feed cropped exactly as it will land on the card or pack (shape included), the card/pack name, and the countdown.
2. A Front/Back toggle turns the camera (3D flip); the back shows a large rear screen with the same cropped live feed and countdown. The choice is remembered for the session (not across reloads).
3. After a capture (camera or upload): flash → a print slides out of the top slot → the photo develops from pale to full colour → single mode: the print flips and the editor's card reveal continues; pack mode: the pack rises, the print drops in, the pack opening starts.
4. Tap or any deliberate key skips the print sequence to its hand-off.
5. Reduced motion: no flip animation (toggle switches instantly), no flash/eject/develop; capture goes straight to the editor/pack as today.
6. No real brand names, logos, or product wording anywhere in the art or copy; the camera is an original pixel drawing inspired by the reference's shapes and colours, with "PIXEL BOOTH" lettering where brand marks were.
7. 375 px wide: no horizontal scroll; the side screen folds over the camera's lower-right corner.

## Scope

**In:** camera art (front, back), side screen and rear screen live crop, Front/Back toggle, shutter-click shortcut, flash, instant print sequence and hand-offs, reduced motion, tests.

**Out:** sound, lens reflection of the live feed, film-effect dials that change the photo, printing the instant-print frame itself, changes to the editor reveal or pack opening beyond receiving the hand-off.

## Camera art (`src/camera/cameraArt.ts`)

Pixel art drawn with the existing helpers (`panel`, `fill`, `outline`, `withDropShadow`, `drawTextCentered`) at art resolution and upscaled nearest-neighbour, like the cards.

- `CAMERA_ART = { w: 128, h: 88 }` body (+3 px drop shadow → `CAMERA_SIZE = { w: 131, h: 91 }`).
- New colours in `colors.ts`: `SILVER`, `SILVER_DARK`, `SILVER_LIGHT`, `LEATHER`, `LEATHER_DARK`, `COPPER`, `LENS_DARK`.
- **Front** (`drawCameraFront(ctx)`): rounded silver body with dark outline; top plate with a square viewfinder window (centre-left), round chrome shutter button (centre-right, exported rect `SHUTTER`), flash window with a small red light (top-right); brown leather panel (lower ~75 %) with a dithered pebble texture; big lens centred on the leather (silver ring, dark barrel rings, glass with a highlight); copper power dial bottom-left; "PIXEL BOOTH" in small pixel letters on the top plate (left). A thin print slot along the top edge.
- **Back** (`drawCameraBack(ctx)`): same body silhouette; large rear screen rect (exported `REAR_SCREEN`), two small dials and a 4-way pad to its right, print slot on top, leather strip along the bottom.
- `cameraArt(side: 'front' | 'back', scale, target?)` → canvas `CAMERA_SIZE × scale` (cached per side+scale).

## Booth screen

- Replaces the card canvas (`.preview-wrap`) with `CameraStage`:
  - A `TiltCard` (bob + pointer tilt) holding a flipper: `.camera-flip` with two faces (front canvas, back canvas + rear-screen overlay), `rotateY(180deg)` when `side === 'back'`, 500 ms transition.
  - **Side screen** (front only): a DOM element hinged to the camera's right edge (`.side-screen`), pixel bezel via CSS borders, containing a `<canvas>` live crop sized to the current template's photo window aspect (pack mode: the pack viewfinder's 3:4 window), the card/pack name below, and the countdown number overlaid.
  - **Rear screen** (back only): a `<canvas>` absolutely positioned over `REAR_SCREEN` (as % of `CAMERA_SIZE`) with the same live crop (letterboxed to the screen) and countdown.
  - Shutter shortcut: an invisible `<button tabIndex={-1} aria-hidden>` over `SHUTTER` (front) that triggers the same action as "Take photo" when enabled.
- Live crop: `drawLiveCrop(ctx, photo, template)` crops the source like `cropPhoto` to the photo window's aspect (mirrored for the camera) and clips to `photoShape` (arch/circle) using `src/templates/shapes.ts`. Placeholder photo when the camera is not live.
- Countdown: one persistent visually-hidden `aria-live` region stays (from the polish round); the visual number shows on whichever screen is visible.
- Toggle: a `.btn` "Show back" / "Show front" with `aria-pressed`, stored in the booth store as `cameraSide: 'front' | 'back'` (default `front`, not persisted, survives Retake/Change card within the session).
- Messages, Take photo, Upload, Back unchanged.
- Phone (< 560 px): camera width ≈ 100 % of the column; side screen absolutely positioned over the camera's lower-right corner (smaller), so the page never scrolls sideways.

## Instant print sequence

`usePrintSequence(active: boolean, reducedMotion: boolean)` → `{ phase, skip }`, phases `flash → eject → develop → handoff → done`.

| phase | duration | what shows |
|---|---|---|
| `flash` | 150 ms | flash window lights; full-screen white flash overlay fades |
| `eject` | 900 ms | a print (white instax-style frame: thin border, thicker bottom) slides up out of the top slot |
| `develop` | 1200 ms | photo on the print fades from pale/washed (high brightness, low saturation and contrast) to full colour |
| `handoff` | 450 ms | single: print flips to 90°; pack: pack art rises below, print drops into it |
| `done` | — | Booth calls the existing `keep(photo)` → `setCapture` |

- `PRINT_TIMING = { flash: 150, eject: 900, develop: 1200, handoff: 450 }`.
- `skip()` (tap on the stage/print, or a deliberate key — same filter as the pack opening: no Tab, lone modifiers, shortcuts, repeats, or typing in fields) jumps to `done`.
- Reduced motion: `done` immediately (Booth calls `keep` right away, as today).
- The print's photo is the captured photo cropped to 3:4 (instant-film proportions), not the card crop.
- The camera's Take photo / Upload / toggle are disabled while printing; Back to shop cancels (unmount clears timers; nothing is captured).
- Uploads go through the same sequence (the camera "prints" the uploaded photo). A late upload after leaving the booth is still ignored (existing guard).
- Hand-off continuity: single mode lands on the editor in its `back` phase (card back, then flip) — no editor change needed. Pack mode lands on the pack screen's `sealed` phase — no change needed.

## Error handling

- Camera not live: side/rear screens show the template's placeholder photo; capture via Upload still prints.
- Skipping at any phase → `done` exactly once (`keep` called once).
- Unmount mid-sequence (Back, idle reset, tray) → timers cleared, no capture recorded, photo counter unchanged.
- Unknown template shape → rectangle crop.

## Testing

**Unit:**
- `cameraArt`: canvas size per side/scale; cache returns the same canvas; `SHUTTER` and `REAR_SCREEN` inside the body; no text drawn except "PIXEL BOOTH" (spy `drawTextCentered`/font calls).
- `drawLiveCrop`: crop rect matches the photo window aspect for every template and the pack viewfinder; mirrored for camera sources; arch/circle templates clip (spy `clip`).
- `usePrintSequence`: inactive → idle; active walks flash → eject → develop → handoff → done on the timings; `skip()` from each phase → done; key filter; reduced motion → done immediately; unmount clears timers.
- Booth: shows the camera front by default with the side screen labelled by card name; toggle switches to back (`aria-pressed`) and is remembered across Retake; upload runs the print then lands on the editor (single) / pack screen (pack); a key during `develop` skips; reduced motion goes straight to the editor; Back during the print records no photo.
- Styles: reduced-motion block disables the new animations.

**Manual (Chrome):** front, back, mid-flip; 375 px; each print phase for a card and a pack (fake camera and upload); reduced motion.
