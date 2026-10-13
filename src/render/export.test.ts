import { expect, test } from 'vitest'
import { exportFileName } from './export'

test('filename has template id and a filesystem-safe timestamp', () => {
  expect(exportFileName('ticket', new Date('2026-10-13T09:05:07.123Z'))).toBe(
    'pixel-booth-ticket-2026-10-13T09-05-07-123Z.png',
  )
})
