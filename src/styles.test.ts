/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// Vitest stubs CSS imports, so read the stylesheet from disk.
const css = readFileSync('src/index.css', 'utf8')
const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1]

test('composed images (which contain the photo) are not displayed with nearest-neighbour scaling', () => {
  for (const selector of ['.stamp-canvas', '.print-only img']) {
    const body = rule(selector)
    if (selector === '.stamp-canvas') expect(body, selector).toBeDefined()
    expect(body ?? '', selector).not.toMatch(/image-rendering:\s*pixelated/)
  }
})

test('editor text fields use the legible number font (Pixelify digits read as letters)', () => {
  expect(rule('.fields input')).toMatch(/font(-family)?:[^;]*monospace/)
})

test('an empty tray live region takes no space in the column', () => {
  expect(rule('.tray-live:empty')).toMatch(/position:\s*absolute/)
})

test('headings focused by script show no focus ring', () => {
  expect(rule('h2[tabindex="-1"]:focus')).toMatch(/outline:\s*none/)
})

test('reduced motion switches off every new animation', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  const end = block.indexOf('\n}\n')
  const body = block.slice(0, end)
  for (const sel of ['.tile-btn::before', '.tilt-inner.sway', '.tile-btn.spin-in', '.pack-stage .pack-shaker', '.deal.from-pack .deal-card', '.card-glare'])
    expect(body, sel).toContain(sel)
})
