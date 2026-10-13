# Pixel Booth — Design Spec

Date: 2026-10-13
Status: Approved in brainstorming, pending written-spec review

## Purpose

A browser photobooth that turns a webcam capture into a pixel-art **printable keepsake** — a postage stamp, voucher, or ticket. The same app serves three uses:

- **Personal / fun** — take a stamp, download or print it.
- **Event booth** — runs on a laptop or tablet at a party or school event; guests capture and print.
- **Portfolio** — a showcase of the pixel-art rendering.

### Success criteria

1. A user can pick a template, see a live pixelated preview inside the template frame, capture, edit the template's text, and download a crisp PNG or print it — with no network calls beyond loading the site.
2. Download, print, and on-screen preview are pixel-identical in composition (same renderer, different scale).
3. Adding a new template means adding one module and registering it — no changes to camera, store, or screens.
4. The camera is released (indicator light off) whenever the user leaves the booth screen.

## Scope

**In scope (v1):**

- Three templates: Stamp, Voucher, Ticket.
- One composed image per capture.
- Live pixelated preview with adjustable pixel size and optional dithering.
- Editable text fields per template, with defaults and max lengths.
- PNG download at an integer upscale; browser print at a physical size.
- Photo-upload fallback when no camera is available.

**Out of scope (v1), designed not to block later:**

- Sheet layouts (multiple stamps or shots on one page) — the renderer must be callable multiple times onto one canvas so a sheet can be added later.
- QR hand-off, backend, storage, or gallery.
- A visual template editor.

## Stack

- Vite + React + TypeScript, static build, no server.
- Node LTS (v24) for tooling. Latest stable versions of Vite/React/TS at scaffold time (avoiding day-one majors); lockfile committed.
- Zustand for client state.
- Vitest for unit tests.
- Canvas 2D for all pixel processing and composition.
- A free OFL-licensed pixel font (Press Start 2P or Silkscreen), self-hosted in the repo.

Next.js was considered and rejected: no server features are used. A single vanilla HTML file was rejected: harder to extend with multiple templates and editable fields.

## Architecture

```
src/
  camera/      useCamera hook — getUserMedia, start/stop, mirroring, error state
  pixel/       pixelate() — downscale → palette quantize → optional dither (pure)
  templates/   types.ts, stamp.ts, voucher.ts, ticket.ts, registry.ts
  render/      composeStamp(template, photo, fields, scale) → canvas
  store/       Zustand store
  screens/     TemplatePicker, Booth, Editor
  fonts/       pixel font files
```

### Units

**`camera/useCamera`**
- Requests `getUserMedia({ video: true })`, exposes `{ videoRef, status, error, start, stop }`.
- `status`: `idle | requesting | live | denied | unavailable | insecure`.
- `insecure` when `window.isSecureContext` is false.
- Stops all tracks on `stop()` and on unmount.
- Preview is mirrored (selfie view); the captured frame is mirrored the same way so the result matches what the user saw.

**`pixel/pixelate(source, opts) → ImageData`**
- `opts`: `{ width, height, palette: RGB[], dither: boolean }`.
- Draws `source` (video, image, or canvas) cover-cropped into a `width × height` offscreen canvas.
- Quantizes each pixel to the nearest palette color (squared RGB distance). With `dither`, uses ordered 4×4 Bayer dithering before quantizing.
- Pure apart from the offscreen canvas; output contains only palette colors.

**`templates/types.ts`**

```ts
interface TemplateField {
  key: string;
  label: string;
  default: string | (() => string); // function form for generated values, e.g. ticket serial
  maxLength: number;
}

interface Template {
  id: string;
  name: string;
  size: { w: number; h: number };       // in art pixels (pre-upscale)
  photoRect: { x: number; y: number; w: number; h: number }; // art pixels
  palette: RGB[];
  fields: TemplateField[];
  printSizeMm: { w: number; h: number };
  render(ctx: CanvasRenderingContext2D, photo: ImageData, values: Record<string, string>): void;
}
```

All template geometry is in **art pixels**. Templates draw at scale 1; scaling happens in the composer.

**Templates (v1):**

| Template | Look | Fields (default) |
|---|---|---|
| Stamp | Perforated scalloped edge, inner border, value in corner | `title` ("FIRST STAMP", 14), `value` ("25¢", 5) |
| Voucher | Wide coupon, dashed cut line, stub section | `title` ("VOUCHER", 14), `amount` ("FREE HUG", 12), `expires` ("VALID TODAY", 14) |
| Ticket | Admit-one ticket with notched edges and tear-off stub | `event` ("PIXEL PARTY", 14), `date` (today, `YYYY-MM-DD`), `serial` (generated `No. 000123`, 10) |

Serial numbers are random 6-digit values generated on capture; nothing is persisted.

**`templates/registry.ts`** — ordered list of templates; the picker renders from it.

**`render/composeStamp(template, photo, values, scale) → HTMLCanvasElement`**
- Creates a `size.w × size.h` canvas, calls `template.render`, then upscales by integer `scale` onto a second canvas with `imageSmoothingEnabled = false`.
- Used for live preview (small scale), PNG download (large scale, e.g. 8×), and print.
- Must be safe to call repeatedly (future sheet layouts place several results on one page).

**`store/`** (Zustand)
- `templateId`, `pixelSize`, `dither`, `capture: ImageData | null`, `values: Record<string, string>`.
- Actions: `selectTemplate` (resets `values` to the template's defaults), `setCapture`, `setValue` (clamps to `maxLength`), `reset`.

**`screens/`**
- **TemplatePicker** — cards rendered with `composeStamp` using a placeholder photo.
- **Booth** — live preview loop (`requestAnimationFrame`: pixelate current video frame → compose → draw), pixel-size slider, dither toggle, 3-2-1 countdown, capture button, upload fallback.
- **Editor** — composed result, text inputs for the template's fields (live re-render), Download PNG, Print, Retake, Change template.

### Data flow

```
video frame ─▶ pixelate ─▶ ImageData ─▶ composeStamp(template, photo, values, scale) ─▶ canvas
                                 │                                  ├─ preview (Booth/Editor)
                         capture ▼ store                            ├─ toBlob → download PNG
                                                                    └─ print view
```

### Output

- **Download:** `composeStamp` at scale 8, `canvas.toBlob('image/png')`, filename `pixel-booth-<template>-<timestamp>.png`.
- **Print:** a print-only container holding the composed image sized to `printSizeMm` via CSS; `@media print` hides the rest of the UI; then `window.print()`. `image-rendering: pixelated` keeps edges crisp.

## Error handling

- **Camera denied / no device** — explanatory screen with Retry and "Upload a photo" (file input → image → same pixelate path).
- **Insecure context** — message stating the camera requires HTTPS or localhost.
- **Leaving Booth** — camera tracks stopped.
- **Text overflow** — inputs enforce `maxLength`; templates lay out text assuming the max.
- **Upload of non-image / decode failure** — inline error, stay on Booth.

## Privacy

No network requests for photos, no storage, no analytics. The capture lives in memory until the user downloads or prints it, and is discarded on reset or reload.

## Testing

**Unit (Vitest, jsdom + canvas polyfill as needed):**
- `pixelate` returns `width × height` output; every output pixel is a palette color; dither on/off both respect the palette.
- Every registered template: `photoRect` lies within `size`, field keys are unique, defaults are within `maxLength`, `render` runs without throwing on a blank photo.
- Store: `selectTemplate` resets values to defaults; `setValue` clamps to `maxLength`.
- `composeStamp` output dimensions equal `size × scale`.

**Manual:**
- Capture with each template on a real webcam; download and inspect PNG; open print preview.
- Deny camera permission → error screen → upload fallback works.
- Navigate away from Booth → camera light turns off.

## Deployment

Static `dist/` from `vite build`, deployable to any static host (nginx, Dokploy static app, GitHub Pages). Must be served over HTTPS for camera access. No environment variables or secrets.

## Future (not v1)

- Sheet layouts: N copies or N shots on one printable page, built on `composeStamp`.
- QR hand-off via a small backend + object storage with auto-expiry.
- More templates (boarding pass, ID card, trading card).
