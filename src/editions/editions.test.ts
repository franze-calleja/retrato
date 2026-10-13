import { describe, expect, test } from 'vitest'
import { GLYPHS } from '../templates/pixelFont'
import { hsl } from './effects'
import { DEFAULT_WEIGHTS, editions, getEdition } from './registry'

test('registry order, unique ids, default weights', () => {
  expect(editions.map((e) => e.id)).toEqual(['common', 'foil', 'holo', 'poly'])
  expect(DEFAULT_WEIGHTS).toEqual({ common: 60, foil: 25, holo: 12, poly: 3 })
})

test('getEdition falls back to common', () => {
  expect(getEdition('holo').id).toBe('holo')
  expect(getEdition('nope').id).toBe('common')
  expect(getEdition(undefined).id).toBe('common')
})

test('rare flags and badges', () => {
  expect(editions.filter((e) => e.rare).map((e) => e.id)).toEqual(['holo', 'poly'])
  expect(editions.map((e) => e.badge)).toEqual([undefined, '★ FOIL', '★ HOLO', '★★ POLY'])
})

test('badge text only uses glyphs the bitmap font has', () => {
  for (const e of editions) for (const ch of e.badge ?? '') expect(GLYPHS[ch], `${e.id} ${ch}`).toBeDefined()
})

test('hsl converts primaries', () => {
  expect(hsl(0, 1, 0.5)).toEqual([255, 0, 0])
  expect(hsl(1 / 3, 1, 0.5)).toEqual([0, 255, 0])
})

describe.each(editions.map((e) => [e.id, e] as const))('edition %s', (_id, e) => {
  test('overlay matches hasEffect and has w × h size', () => {
    const img = e.overlay(40, 30, 0.2)
    if (!e.hasEffect) return expect(img).toBeNull()
    expect([img?.width, img?.height]).toEqual([40, 30])
  })
  test('effect changes with angle', () => {
    if (!e.hasEffect) return
    const a = e.overlay(40, 30, 0.1)!.data.join(',')
    const b = e.overlay(40, 30, 0.6)!.data.join(',')
    expect(a).not.toBe(b)
  })
})
