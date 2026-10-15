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
  for (const sel of ['.tile-btn::before', '.tilt-inner.sway', '.tile-btn.spin-in', '.pack-stage[data-phase] .pack-shaker', '.deal.from-pack .deal-card', '.card-glare', '.camera-flip', '.camera-flash.on', '.instant-print', '.screen-flash'])
    expect(body, sel).toContain(sel)
})

test('the glare wrapper is a block so the card keeps its full width', () => {
  expect(rule('.card-glare')).toMatch(/display:\s*block/)
})

test('no two @keyframes share a name (the last one would silently win)', () => {
  const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
  expect(names.length - new Set(names).size).toBe(0)
})

test('reduced motion beats the pack-stage phase rules on specificity', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  expect(block).toContain(".pack-stage[data-phase] .pack-shaker")
  expect(block).toContain(".pack-stage[data-phase] canvas")
  expect(block).toContain(".pack-stage[data-phase] .pack-flash")
})

test('the print comes out of the side: the camera makes room sideways on wide screens', () => {
  expect(rule(".camera-stage.printing[data-side='front'] .camera-holder > .tilt")).toMatch(/translate:\s*16cqw/)
  expect(rule(".camera-stage.printing[data-side='back'] .camera-holder > .tilt")).toMatch(/translate:\s*-16cqw/)
})

test('the operator panel scrolls inside the screen, so Close stays reachable on short screens', () => {
  const body = rule('.operator-panel') ?? ''
  expect(body).toMatch(/max-height:\s*calc\(100dvh - 32px\)/)
  expect(body).toMatch(/overflow-y:\s*auto/)
})
