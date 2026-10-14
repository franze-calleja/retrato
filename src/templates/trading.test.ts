import { expect, test } from 'vitest'
import { refreshPerCapture, resolveDefaults } from './fields'
import { getTemplate } from './registry'
import { rollStat, statValue } from './trading'

test('rollStat gives 1–9 across the whole random range', () => {
  expect(rollStat(() => 0)).toBe('1')
  expect(rollStat(() => 0.5)).toBe('5')
  expect(rollStat(() => 0.9999)).toBe('9')
})

test('statValue reads digits and clamps; anything else is 0 pips', () => {
  expect(statValue('7')).toBe(7)
  expect(statValue('0')).toBe(0)
  expect(statValue('x')).toBe(0)
  expect(statValue('')).toBe(0)
  expect(statValue('-3')).toBe(0)
  expect(statValue('99')).toBe(9)
})

test('stats roll on every capture; name and type are kept', () => {
  const t = getTemplate('trading')
  const values = { ...resolveDefaults(t), name: 'ALEX', type: 'DJ', charm: 'x', chaos: 'x', luck: 'x' }
  const next = refreshPerCapture(t, values)
  expect(next.name).toBe('ALEX')
  expect(next.type).toBe('DJ')
  for (const k of ['charm', 'chaos', 'luck']) expect(next[k]).toMatch(/^[1-9]$/)
})

test('prints at trading-card size with the art aspect ratio', () => {
  const t = getTemplate('trading')
  expect(t.printSizeMm.w).toBe(63)
  expect(t.printSizeMm.h / t.printSizeMm.w).toBeCloseTo(t.size.h / t.size.w, 2)
})
