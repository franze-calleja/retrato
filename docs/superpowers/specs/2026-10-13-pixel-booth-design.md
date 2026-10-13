# Pixel Booth — Design Spec

Date: 2026-10-13
Status: Revised 2026-10-13 (photo stays original; Balatro-inspired designs). Pending written-spec review.

## Purpose

A browser photobooth that places a webcam capture into a **Balatro-inspired pixel-art keepsake** — a postage stamp, voucher, or ticket — that you can download or print. The same app serves three uses:

- **Personal / fun** — take one, download or print it.
- **Event booth** — runs on a laptop or tablet at a party or school event; guests capture and print.
- **Portfolio** — a showcase of the visual style.

### The look

- **The photo is untouched**: original colors, full resolution, smooth. No pixelation, filters, or effects.
- **The designs are pixel art in the spirit of Balatro**: chunky frames with thick dark outlines, stepped "rounded" pixel corners, solid offset drop shadows, rich saturated colors (deep red, teal-blue, gold, cream on dark), and chunky pixel lettering with a dark text shadow.
- **The app chrome matches**: a slowly swirling psychedelic paint background, template cards that tilt toward the pointer and gently bob, and a "pop" when a photo is taken.
- Inspired by, not copied from: no Balatro assets, fonts, card art, or names are used.

### Success criteria

1. A user can pick a template, see the live camera inside the template frame, capture, edit the template's text, and download a PNG or print it — with no network calls beyond loading the site.
2. Download, print, and on-screen preview are identical in composition (same renderer, different scale).
3. The photo in the output is at full output resolution and visibly smooth; the frame's pixel edges are perfectly crisp.
4. Adding a new template means adding one module and registering it — no changes to camera, store, or screens.
5. The camera is released (indicator light off) whenever the user leaves the booth screen.

## Scope

**In scope (v1):**

- Three templates: Stamp, Voucher, Ticket.
- One composed image per capture.
- Live preview with the camera feed inside the chosen frame.
- Editable text fields per template, with defaults and max lengths.
- PNG download; browser print at a physical size.
- Photo-upload fallback when no camera is available.
- Balatro-inspired UI: swirl background, tilting/bobbing template cards, capture pop. All motion disabled under `prefers-reduced-motion`.

**Out of scope (v1), designed not to block later:**

- Sheet layouts (multiple prints on one page) — the composer must be callable multiple times onto one canvas.
- QR hand-off, backend, storage, gallery.
- Photo filters or effects.
- A visual template editor.

## Stack

- Vite + React + TypeScript, static build, no server.
- Node LTS (v24). Latest stable Vite/React/TS at scaffold time, avoiding very new releases; lockfile committed.
- Zustand for client state. Vitest for unit tests.
- Canvas 2D for composition; WebGL (one small fragment shader) for the swirl background, with a static CSS gradient fallback.
- Canvas text: a built-in 3×5 bitmap font drawn at art scale (crisp at any upscale, synchronous, no font loading).
- UI text: Pixelify Sans (OFL-1.1), self-hosted via `@fontsource/pixelify-sans`.

## Rendering model

Each template has an **art canvas** measured in art pixels (e.g. stamp 104×128 including shadow margin). The frame, decorations, and text are drawn at 1 art pixel = 1 unit, then upscaled by an integer `scale` with smoothing **off** — so frame pixels stay crisp.

The photo is **not** part of the art canvas. After upscaling the frame, the composer draws the photo into `photoRect × scale` with smoothing **on, high quality**. So in a download at scale 8 the stamp's photo is 576×672 real pixels.

```
render frame at art scale ─▶ upscale ×scale (nearest) ─▶ draw photo into photoRect×scale (smooth) ─▶ canvas
```

## Architecture

```
src/
  camera/      useCamera hook — getUserMedia, start/stop, error state
  photo/       coverCrop (pure), cropPhoto → canvas at a target size, optional mirror
  templates/   types, draw helpers, bitmap font, fields, stamp, voucher, ticket, registry, placeholder
  render/      composeStamp, export constants + filename
  store/       Zustand store
  ui/          SwirlBackground (WebGL), TiltCard
  screens/     TemplatePicker, Booth, Editor, StampCanvas
```

### Units

**`camera/useCamera`**
- Requests `getUserMedia({ video })`, exposes `{ videoRef, status, start, stop }`.
- `status`: `idle | requesting | live | denied | unavailable | insecure`.
- Stops tracks on `stop()`, on unmount, and when a request resolves after the hook was stopped/unmounted.

**`photo/`**
- `coverCrop(srcW, srcH, dstW, dstH)` — largest centered source region with the target's aspect. Pure.
- `cropPhoto(source, srcW, srcH, { width, height, mirror }) → HTMLCanvasElement` — draws the cover-cropped source at the target size with high-quality smoothing. Camera captures are mirrored (selfie view, matches the preview); uploads are not.
- Captures are taken at `photoRect × EXPORT_SCALE` so download and print use the full captured resolution.

**`templates/types.ts`**

```ts
interface TemplateField {
  key: string
  label: string
  default: string | (() => string)
  maxLength: number
  perCapture?: boolean // regenerate on each capture (ticket serial)
}

interface Template {
  id: string
  name: string
  size: { w: number; h: number }      // art pixels, includes drop-shadow margin
  photoRect: Rect                      // art pixels
  fields: readonly TemplateField[]
  printSizeMm: { w: number; h: number }
  render(ctx: CanvasRenderingContext2D, values: Record<string, string>): void // frame + text only
}
```

**Templates (v1):**

| Template | Look | Fields (default) |
|---|---|---|
| Stamp | Perforated edge, thick dark outline, deep-red panel, cream inner border around the photo, gold value badge, offset shadow | `title` ("FIRST STAMP", 14), `value` ("25¢", 5) |
| Voucher | Wide card, teal-blue panel, rounded pixel corners, dashed cut line with notches, gold amount plate, tear-off stub | `title` ("VOUCHER", 14), `amount` ("FREE HUG", 12), `expires` ("VALID TODAY", 14) |
| Ticket | Admit-one ticket, gold/orange panel, notched sides, perforated stub with serial | `event` ("PIXEL PARTY", 14), `date` (today, `YYYY-MM-DD`), `serial` (`NO. 000123`, 10, per capture) |

Text is drawn uppercase in the bitmap font with a 1-art-pixel dark drop shadow; titles use 2× glyphs when they fit.

**`templates/placeholder.ts`** — a smooth generated image (gradient + simple face) used in the picker and before the camera is live.

**`render/composeStamp(template, photo, values, scale, target?) → HTMLCanvasElement`**
- `photo` is any `CanvasImageSource` with known size (`{ source, w, h }` — a captured canvas, the live `<video>`, or the placeholder).
- Renders the frame at art scale, upscales with smoothing off, then draws the photo cover-cropped into `photoRect × scale` with smoothing on.
- Used for the live preview (scale 4), the editor preview (scale 4), and download/print (scale 8).
- Safe to call repeatedly.

**`store/`** (Zustand)
- `screen`, `templateId`, `capture: HTMLCanvasElement | null`, `values`.
- `selectTemplate` (resets values only when switching to a different template), `setCapture` (refreshes per-capture fields only), `retake`, `goToPicker`, `setValue` (clamps to `maxLength` by code point).

**`ui/SwirlBackground`** — fixed full-screen canvas behind the app running a small WebGL fragment shader: two or three warm/cool colors swirling slowly, rendered at low resolution and upscaled pixelated. Falls back to a static CSS gradient when WebGL is unavailable. Static (one frame) under `prefers-reduced-motion`. Pauses when the tab is hidden.

**`ui/TiltCard`** — wrapper that tilts its child toward the pointer (3D transform, max ~10°), gently bobs when idle, and lifts its shadow on hover/focus. No motion under `prefers-reduced-motion`.

**`screens/`**
- **TemplatePicker** — templates as tilting cards over the swirl background.
- **Booth** — live preview loop (`requestAnimationFrame`: compose with the `<video>` as the photo, mirrored), 3-2-1 countdown, capture with a pop/flash, upload fallback, back.
- **Editor** — composed result, text inputs (live re-render), Download PNG, Print, Retake, Change template.

### Data flow

```
<video>/upload ─▶ cropPhoto (photoRect × 8, mirrored if camera) ─▶ store.capture
                                                                   │
store.values ─────────────────────────────▶ composeStamp(template, capture, values, scale)
                                                   ├─ preview canvas (scale 4)
                                                   ├─ toBlob → download PNG (scale 8)
                                                   └─ print view (scale 8, sized in mm)
```

### Output

- **Download:** `composeStamp` at scale 8 → `canvas.toBlob('image/png')`, filename `pixel-booth-<template>-<timestamp>.png`.
- **Print:** print-only container with the composed image sized to `printSizeMm`; `@media print` hides the rest of the UI (including the swirl background); `window.print()`.

## Error handling

- **Camera denied / no device** — explanatory notice with Retry and "Upload a photo".
- **Insecure context** — message that the camera needs HTTPS or localhost; upload still works.
- **Leaving Booth** — camera tracks stopped, including late-arriving streams.
- **Text** — inputs clamp to `maxLength` by code point; lowercase is drawn uppercase; unsupported characters draw as `?`; never throws.
- **Upload of non-image / decode failure** — inline error, stay on Booth.
- **No WebGL** — static gradient background; everything else works.

## Privacy

No network requests for photos, no storage, no analytics. The capture lives in memory until downloaded or printed and is discarded on reset or reload.

## Testing

**Unit (Vitest, jsdom + vitest-canvas-mock):**
- `coverCrop` centers and never stretches (landscape→portrait, portrait→landscape, same aspect).
- `cropPhoto` returns a canvas of the requested size.
- Bitmap font: glyph table well-formed, measure/fit math, unknown characters fall back, drawing never throws.
- Every registered template: `photoRect` within `size`, unique field keys, defaults within `maxLength`, `render` doesn't throw with defaults, max-length junk, or empty values.
- `composeStamp` output size is `size × scale`; rejects non-integer scale; reusable target.
- Store: template switch vs re-select, per-capture refresh, retake keeps values, clamping.
- `useCamera`: insecure, denied, unavailable, live→stop, unmount, late stream after unmount.

**Manual:**
- Capture with each template; download and inspect PNG (crisp frame, smooth photo); print preview at physical size.
- Deny camera → notice → upload fallback.
- Leave Booth → camera light off.
- Reduced-motion setting → no swirl/tilt/bob motion.
- Phone-width viewport → no horizontal scroll.

## Deployment

Static `dist/` from `vite build`, deployable to any static host (nginx, Dokploy static app, GitHub Pages). Must be served over HTTPS for camera access. No environment variables or secrets.

## Future (not v1)

- Sheet layouts built on `composeStamp`.
- QR hand-off via a small backend + object storage with auto-expiry.
- More templates (boarding pass, ID card, trading card).
- Optional photo filters.
