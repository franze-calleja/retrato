import { expect, test } from 'vitest'
import { getTemplate, templates } from '../templates/registry'
import { PACK_SIZE, dealPack, pickDistinct } from './deal'

/** Small seeded PRNG (mulberry32) for deterministic deals. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const settings = (forced = 'random') => ({ weights: { common: 60, foil: 25, holo: 12, poly: 3 }, forced })

test('deals PACK_SIZE distinct card types', () => {
  for (let s = 1; s < 50; s++) {
    const ids = dealPack(settings(), {}, seeded(s)).map((c) => c.templateId)
    expect(ids).toHaveLength(PACK_SIZE)
    expect(new Set(ids).size).toBe(PACK_SIZE)
  }
})

test('card types and editions are deterministic for the same random source', () => {
  // Per-capture fields (serials, stats) roll with their own randomness.
  const pick = (cards: ReturnType<typeof dealPack>) => cards.map((c) => [c.templateId, c.edition])
  expect(pick(dealPack(settings(), {}, seeded(7)))).toEqual(pick(dealPack(settings(), {}, seeded(7))))
})

test('each card rolls its edition from operator settings', () => {
  for (const card of dealPack(settings('holo'), {}, seeded(3))) expect(card.edition).toBe('holo')
})

test('uses remembered values for a card type and refreshes per-capture fields', () => {
  const ticket = getTemplate('ticket')
  const saved = { ticket: { event: 'GRAD NIGHT', date: '2026-01-01', serial: 'NO. 111111' } }
  // rand() = 0 deals voucher, ticket, trading (Fisher–Yates with j = 0 every step).
  const card = dealPack(settings(), saved, () => 0).find((c) => c.templateId === 'ticket')!
  expect(card.values.event).toBe('GRAD NIGHT')
  expect(card.values.date).toBe('2026-01-01')
  expect(card.values.serial).toMatch(/^NO\. \d{6}$/)
  expect(Object.keys(card.values).sort()).toEqual(ticket.fields.map((f) => f.key).sort())
})

test('cards without remembered values use their defaults', () => {
  const card = dealPack(settings(), {}, () => 0).find((c) => c.templateId === 'voucher')!
  expect(card.values.title).toBe('VOUCHER')
})

test('pickDistinct never repeats and caps at the number of items', () => {
  expect(pickDistinct(['a', 'b'], 3, Math.random).sort()).toEqual(['a', 'b'])
  expect(new Set(pickDistinct(templates, 3, seeded(9))).size).toBe(3)
})
