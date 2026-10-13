import { expect, test } from 'vitest'
import { refreshPerCapture, resolveDefaults } from './fields'
import { getTemplate, templates } from './registry'
import { randomSerial, todayIso } from './ticket'

test('todayIso uses the local date as YYYY-MM-DD', () => {
  expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
})

test('randomSerial is "NO. " + 6 zero-padded digits', () => {
  expect(randomSerial(() => 0)).toBe('NO. 000000')
  expect(randomSerial(() => 0.000123)).toBe('NO. 000123')
  expect(randomSerial(() => 0.9999999)).toBe('NO. 999999')
})

test('ticket serial regenerates per capture; event name is kept', () => {
  const t = getTemplate('ticket')
  const next = refreshPerCapture(t, { ...resolveDefaults(t), event: 'GRAD NIGHT', serial: 'NO. 111111' })
  expect(next.event).toBe('GRAD NIGHT')
  expect(next.serial).toMatch(/^NO\. \d{6}$/)
})

test('registry lists stamp, voucher, ticket in order', () => {
  expect(templates.map((t) => t.id)).toEqual(['stamp', 'voucher', 'ticket'])
})
