import { beforeEach, expect, test } from 'vitest'
import { migrateKey } from './storage'

beforeEach(() => localStorage.clear())

test('moves a value saved under an old key to the new key', () => {
  localStorage.setItem('old', '{"a":1}')
  migrateKey('old', 'new')
  expect(localStorage.getItem('new')).toBe('{"a":1}')
  expect(localStorage.getItem('old')).toBeNull()
})

test('never overwrites a value already under the new key', () => {
  localStorage.setItem('old', '{"a":1}')
  localStorage.setItem('new', '{"a":2}')
  migrateKey('old', 'new')
  expect(localStorage.getItem('new')).toBe('{"a":2}')
})

test('does nothing when there is no old value', () => {
  migrateKey('old', 'new')
  expect(localStorage.getItem('new')).toBeNull()
})
