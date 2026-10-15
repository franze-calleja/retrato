import { expect, test } from 'vitest'
import { refreshPerCapture, resolveDefaults } from './fields'
import { JOKER_EFFECTS } from './jester'
import { COSMIC_LINES, PLANETS } from './planet'
import { measureText, wrapText } from './pixelFont'
import { getTemplate, templates } from './registry'
import { ARCANA, FRIENDLY_ARCANA, numeralFor, randomArcana } from './tarot'

test('22 major arcana with numerals 0–XXI', () => {
  expect(ARCANA).toHaveLength(22)
  expect(ARCANA[0]).toEqual({ numeral: '0', title: 'THE FOOL' })
  expect(ARCANA[17]).toEqual({ numeral: 'XVII', title: 'THE STAR' })
  expect(ARCANA[21]).toEqual({ numeral: 'XXI', title: 'THE WORLD' })
})

test('the default pool leaves out the gloomy cards', () => {
  for (const t of ['DEATH', 'THE DEVIL', 'THE TOWER', 'THE HANGED MAN']) {
    expect(FRIENDLY_ARCANA.some((a) => a.title === t)).toBe(false)
  }
  expect(FRIENDLY_ARCANA).toHaveLength(18)
  expect(randomArcana(() => 0)).toBe(FRIENDLY_ARCANA[0].title)
  expect(randomArcana(() => 0.9999)).toBe(FRIENDLY_ARCANA[17].title)
})

test('numeral follows the title, case-insensitively; custom titles have none', () => {
  expect(numeralFor('THE STAR')).toBe('XVII')
  expect(numeralFor('the star')).toBe('XVII')
  expect(numeralFor('DEATH')).toBe('XIII')
  expect(numeralFor('THE PARTY')).toBe('')
})

test('tarot title, planet + line, and jester effect roll on every capture', () => {
  for (const [id, keys] of [['tarot', ['title']], ['planet', ['planet', 'effect']], ['jester', ['effect']]] as const) {
    const t = getTemplate(id)
    const stale = Object.fromEntries(keys.map((k) => [k, 'STALE']))
    const next = refreshPerCapture(t, { ...resolveDefaults(t), ...stale })
    for (const k of keys) expect(next[k], `${id}.${k}`).not.toBe('STALE')
  }
})

test('planet names and cosmic lines fit their fields', () => {
  const t = getTemplate('planet')
  const max = (k: string) => t.fields.find((f) => f.key === k)!.maxLength
  for (const p of PLANETS) expect(p.length).toBeLessThanOrEqual(max('planet'))
  for (const l of COSMIC_LINES) expect(l.length).toBeLessThanOrEqual(max('effect'))
})

test('every jester effect fits its two-line box', () => {
  for (const e of JOKER_EFFECTS) expect(wrapText(e, 70, 2).join(' ')).toBe(e)
})

test('wrapText breaks on words, hard-splits long words, and caps the line count', () => {
  expect(wrapText('DOUBLES ALL SNACKS', 44, 2)).toEqual(['DOUBLES ALL', 'SNACKS'])
  expect(wrapText('', 40, 2)).toEqual([])
  for (const line of wrapText('SUPERCALIFRAGILISTIC', 20, 3)) expect(measureText(line)).toBeLessThanOrEqual(20)
  expect(wrapText('A B C D E F G H', 7, 2)).toHaveLength(2)
})

test('photo shapes: planet is round, tarot is arched, the rest are rectangles', () => {
  expect(getTemplate('planet').photoShape).toBe('circle')
  expect(getTemplate('tarot').photoShape).toBe('arch')
  for (const id of ['stamp', 'voucher', 'ticket', 'trading', 'id', 'jester']) {
    expect(getTemplate(id).photoShape ?? 'rect').toBe('rect')
  }
})

test('registry lists the new cards at the end', () => {
  expect(templates.map((t) => t.id)).toEqual(['stamp', 'voucher', 'ticket', 'trading', 'id', 'tarot', 'planet', 'jester'])
})
