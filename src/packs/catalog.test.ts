import { expect, test } from 'vitest'
import { templates } from '../templates/registry'
import { PACKS, getPack } from './catalog'

test('four packs with unique ids, in shelf order', () => {
  expect(PACKS.map((p) => p.id)).toEqual(['classic', 'arcana', 'cosmic', 'jester'])
})

test('every pack draws from real cards and says what it deals', () => {
  const ids = new Set(templates.map((t) => t.id))
  for (const p of PACKS) {
    expect(p.pool.length, p.id).toBeGreaterThan(0)
    for (const id of p.pool) expect(ids.has(id), `${p.id} → ${id}`).toBe(true)
    expect(p.description).toMatch(/keep 1/i)
    expect(p.name).toMatch(/ Pack$/)
  }
})

test('classic keeps the five original cards; themed packs deal one type', () => {
  expect(getPack('classic').pool).toEqual(['stamp', 'voucher', 'ticket', 'trading', 'id'])
  expect(getPack('arcana').pool).toEqual(['tarot'])
  expect(getPack('cosmic').pool).toEqual(['planet'])
  expect(getPack('jester').pool).toEqual(['jester'])
})

test('unknown pack ids fall back to classic', () => {
  expect(getPack('nope').id).toBe('classic')
})
