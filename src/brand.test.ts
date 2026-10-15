/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const APP_NAME = 'Retrato'

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.(ts|tsx|css)$/.test(e.name) && !/\.test\./.test(e.name) ? [join(dir, e.name)] : [],
  )

// The only allowed mentions: the old storage keys, read once so saved settings carry over.
const LEGACY_KEYS = /'pixel-booth:(operator|stats)'/g

test('the old app name is gone from the app', () => {
  const hits = [...sources('src'), 'index.html', 'package.json', 'README.md'].filter((f) =>
    ((s) => /pixel[\s-]?booth/i.test(s) || s.includes("'BOOTH'"))(readFileSync(f, 'utf8').replace(LEGACY_KEYS, '')),
  )
  expect(hits).toEqual([])
})

test('the page title and logo use the new name', () => {
  expect(readFileSync('index.html', 'utf8')).toContain(`<title>${APP_NAME}</title>`)
  expect(readFileSync('src/App.tsx', 'utf8')).toContain(`>${APP_NAME.toUpperCase()}</h1>`)
})
