import { afterEach, expect, test } from 'vitest'
import { isPrintShortcut } from './printShortcut'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)
afterEach(() => document.body.replaceChildren())

test('Cmd+P and Ctrl+P, by key or by physical key', () => {
  expect(isPrintShortcut(key({ key: 'p', metaKey: true }))).toBe(true)
  expect(isPrintShortcut(key({ key: 'P', ctrlKey: true }))).toBe(true)
  expect(isPrintShortcut(key({ key: 'з', code: 'KeyP', ctrlKey: true }))).toBe(true) // Cyrillic layout
})

test('ignores other shortcuts, key repeat, and plain P', () => {
  expect(isPrintShortcut(key({ key: 'p' }))).toBe(false)
  expect(isPrintShortcut(key({ key: 'P', ctrlKey: true, shiftKey: true }))).toBe(false)
  expect(isPrintShortcut(key({ key: 'p', metaKey: true, altKey: true }))).toBe(false)
  expect(isPrintShortcut(key({ key: 'p', metaKey: true, repeat: true }))).toBe(false)
})

test('ignored while a modal dialog (operator panel) is open', () => {
  const d = document.createElement('div')
  d.setAttribute('aria-modal', 'true')
  document.body.appendChild(d)
  expect(isPrintShortcut(key({ key: 'p', metaKey: true }))).toBe(false)
})
