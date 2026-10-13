/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// Vitest stubs CSS imports, so read the stylesheet from disk.
const css = readFileSync('src/index.css', 'utf8')
const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.*]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1]

test('composed images (which contain the photo) are not displayed with nearest-neighbour scaling', () => {
  for (const selector of ['.stamp-canvas', '.print-only img']) {
    const body = rule(selector)
    if (selector === '.stamp-canvas') expect(body, selector).toBeDefined()
    expect(body ?? '', selector).not.toMatch(/image-rendering:\s*pixelated/)
  }
})
