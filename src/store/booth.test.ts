import { beforeEach, describe, expect, test } from 'vitest'
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
