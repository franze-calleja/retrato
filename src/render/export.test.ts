import { expect, test } from 'vitest'
import { exportFileName } from './export'

test('filename has template id and a filesystem-safe timestamp', () => {
  expect(exportFileName('ticket', new Date('2026-10-13T09:05:07.123Z'))).toBe(
    'retrato-ticket-2026-10-13T09-05-07-123Z.png',
  )
})

test('download names follow the card name guests see (Joker, not the internal id)', async () => {
  const { cardSlug } = await import('./export')
  const { templates } = await import('../templates/registry')
  expect(Object.fromEntries(templates.map((t) => [t.id, cardSlug(t.name)]))).toEqual({
    stamp: 'stamp', voucher: 'voucher', ticket: 'ticket', trading: 'trading', id: 'id', tarot: 'tarot', planet: 'planet', jester: 'joker',
  })
})
