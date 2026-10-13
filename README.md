# Pixel Booth

A browser photobooth that puts your photo inside a pixel-art **stamp**, **voucher**, or **ticket** — download it as a PNG or print it. The photo stays exactly as taken; the frames are pixel art.

Everything runs in the browser. Photos never leave the device.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # static site in dist/
```

The camera needs HTTPS (localhost is fine for development).

## Deploy

Serve `dist/` from any static host (nginx, Dokploy static app, GitHub Pages) over HTTPS. No environment variables.

## Add a template

1. Create `src/templates/<name>.ts` exporting a `Template` (see `src/templates/types.ts`). Draw the frame and text at art-pixel scale with `draw.ts`, `colors.ts`, and `pixelFont.ts`. Leave the photo to the composer — just set `photoRect`.
2. Add it to the list in `src/templates/registry.ts`.
3. `npm test` — the contract test in `templates.test.ts` checks it automatically.

## Credits

UI font: Pixelify Sans (SIL Open Font License 1.1). Visual style inspired by pixel-art card games; all art is original.
