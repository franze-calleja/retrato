import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { PhotoSource } from '../photo/crop'
import { useBooth } from './booth'
import { useOperator } from './operator'

const s = () => useBooth.getState()
const photo = (): PhotoSource => ({ source: document.createElement('canvas'), w: 10, h: 10 })

beforeEach(() => useBooth.setState(useBooth.getInitialState(), true))

describe('booth store', () => {
  test('starts on the picker with stamp defaults', () => {
    expect(s().screen).toBe('picker')
    expect(s().templateId).toBe('stamp')
    expect(s().values.title).toBe('FIRST STAMP')
  })

  test('selectTemplate switches template, resets values, and opens the booth', () => {
    s().selectTemplate('ticket')
    expect(s().screen).toBe('booth')
    expect(s().templateId).toBe('ticket')
    expect(s().values.event).toBe('PIXEL PARTY')
    expect(s().capture).toBeNull()
  })

  test('re-selecting the same template keeps edited values', () => {
    s().selectTemplate('ticket')
    s().setValue('event', 'GRAD NIGHT')
    s().goToPicker()
    s().selectTemplate('ticket')
    expect(s().values.event).toBe('GRAD NIGHT')
  })

  test('setCapture stores the photo, opens the editor, and refreshes per-capture fields only', () => {
    s().selectTemplate('ticket')
    s().setValue('event', 'GRAD NIGHT')
    s().setValue('serial', 'NO. 111111')
    const p = photo()
    s().setCapture(p)
    expect(s().capture).toBe(p)
    expect(s().screen).toBe('editor')
    expect(s().values.event).toBe('GRAD NIGHT')
    expect(s().values.serial).toMatch(/^NO\. \d{6}$/)
  })

  test('retake clears the capture, keeps values, returns to the booth', () => {
    s().selectTemplate('stamp')
    s().setValue('title', 'HELLO')
    s().setCapture(photo())
    s().retake()
    expect(s().capture).toBeNull()
    expect(s().screen).toBe('booth')
    expect(s().values.title).toBe('HELLO')
  })

  test('setValue clamps pasted text to maxLength by code point', () => {
    s().setValue('value', '😀😀😀😀😀😀😀')
    expect(Array.from(s().values.value)).toHaveLength(5)
    s().setValue('title', 'X'.repeat(100))
    expect(s().values.title).toBe('X'.repeat(14))
  })

  test('setValue ignores keys the template does not have', () => {
    s().setValue('nope', 'x')
    expect(s().values).not.toHaveProperty('nope')
  })
})

describe('editions', () => {
  beforeEach(() => {
    localStorage.clear()
    useOperator.getState().reset()
  })

  test('capture rolls the edition from operator settings', () => {
    useOperator.getState().setForced('holo')
    s().selectTemplate('stamp')
    s().setCapture(photo())
    expect(s().edition).toBe('holo')
  })

  test('editing text keeps the edition', () => {
    useOperator.getState().setForced('foil')
    s().setCapture(photo())
    useOperator.getState().setForced('poly')
    s().setValue('title', 'CHANGED')
    expect(s().edition).toBe('foil')
  })

  test('retake then capture rolls again with the current settings', () => {
    useOperator.getState().setForced('foil')
    s().setCapture(photo())
    useOperator.getState().setForced('poly')
    s().retake()
    expect(s().edition).toBe('common')
    s().setCapture(photo())
    expect(s().edition).toBe('poly')
  })

  test('changing template clears the edition', () => {
    useOperator.getState().setForced('holo')
    s().setCapture(photo())
    s().selectTemplate('voucher')
    expect(s().edition).toBe('common')
  })
})

describe('remembered values and packs', () => {
  beforeEach(() => {
    localStorage.clear()
    useOperator.getState().reset()
  })
  afterEach(() => vi.restoreAllMocks())

  test('edits are remembered per card type across switches', () => {
    s().selectTemplate('ticket')
    s().setValue('event', 'GRAD NIGHT')
    s().selectTemplate('stamp')
    expect(s().values.title).toBe('FIRST STAMP')
    s().selectTemplate('ticket')
    expect(s().values.event).toBe('GRAD NIGHT')
  })

  test('selectPack enters pack mode on the booth', () => {
    s().selectPack()
    expect([s().mode, s().screen, s().capture, s().pack]).toEqual(['pack', 'booth', null, null])
  })

  test('a pack capture deals three cards using remembered values and shows the pack screen', () => {
    s().selectTemplate('ticket')
    s().setValue('event', 'GRAD NIGHT')
    useOperator.getState().setForced('foil')
    s().selectPack()
    vi.spyOn(Math, 'random').mockReturnValue(0) // deals voucher, ticket, trading
    s().setCapture(photo())
    expect(s().screen).toBe('pack')
    expect(s().pack).toHaveLength(3)
    expect(s().pack!.every((c) => c.edition === 'foil')).toBe(true)
    expect(s().pack!.find((c) => c.templateId === 'ticket')!.values.event).toBe('GRAD NIGHT')
  })

  test('pickPackCard opens the editor with that card, already revealed, and remembers its text', () => {
    s().selectPack()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    s().setCapture(photo())
    const card = s().pack![1]
    s().pickPackCard(1)
    expect([s().screen, s().templateId, s().edition, s().revealed]).toEqual(['editor', card.templateId, card.edition, true])
    expect(s().values).toEqual(card.values)
    expect(s().saved[card.templateId]).toEqual(card.values)
  })

  test('pickPackCard ignores bad indexes and missing packs', () => {
    s().pickPackCard(0)
    expect(s().screen).toBe('picker')
    s().selectPack()
    s().setCapture(photo())
    s().pickPackCard(7)
    expect(s().screen).toBe('pack')
  })

  test('retake keeps pack mode and clears the deal', () => {
    s().selectPack()
    s().setCapture(photo())
    s().pickPackCard(0)
    s().retake()
    expect([s().mode, s().screen, s().pack, s().revealed, s().capture]).toEqual(['pack', 'booth', null, false, null])
  })

  test('selecting a single card leaves pack mode and resets revealed', () => {
    s().selectPack()
    s().setCapture(photo())
    s().pickPackCard(0)
    s().selectTemplate('stamp')
    expect([s().mode, s().revealed]).toEqual(['single', false])
  })
})
