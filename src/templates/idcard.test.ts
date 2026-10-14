import { expect, test } from 'vitest'
import { refreshPerCapture, resolveDefaults } from './fields'
import { barcodeBars, randomMember, validUntil } from './idcard'
import { getTemplate, templates } from './registry'

test('randomMember is "NO. " + 4 zero-padded digits', () => {
  expect(randomMember(() => 0)).toBe('NO. 0000')
  expect(randomMember(() => 0.0421)).toBe('NO. 0421')
  expect(randomMember(() => 0.99999)).toBe('NO. 9999')
})

test('validUntil is the same day next year; Feb 29 becomes Feb 28', () => {
  expect(validUntil(new Date(2026, 9, 14))).toBe('2027-10-14')
  expect(validUntil(new Date(2028, 1, 29))).toBe('2029-02-28')
})

test('barcode is deterministic per member number, with solid guard bars', () => {
  const a = barcodeBars('NO. 4821', 60)
  expect(a).toHaveLength(60)
  expect(barcodeBars('NO. 4821', 60)).toEqual(a)
  expect(barcodeBars('NO. 4822', 60)).not.toEqual(a)
  expect([a[0], a[1], a[58], a[59]]).toEqual([true, true, true, true])
})

test('member number rolls on every capture; org and name are kept', () => {
  const t = getTemplate('id')
  const next = refreshPerCapture(t, { ...resolveDefaults(t), org: 'ROBOTICS', name: 'SAM', member: 'NO. 1111' })
  expect(next.org).toBe('ROBOTICS')
  expect(next.name).toBe('SAM')
  expect(next.member).toMatch(/^NO\. \d{4}$/)
})

test('prints at bank-card size with the art aspect ratio', () => {
  const t = getTemplate('id')
  expect(t.printSizeMm.w).toBe(85.6)
  expect(t.printSizeMm.h / t.printSizeMm.w).toBeCloseTo(t.size.h / t.size.w, 2)
})

test('registry lists the new cards after the originals', () => {
  expect(templates.map((t) => t.id)).toEqual(['stamp', 'voucher', 'ticket', 'trading', 'id'])
})
