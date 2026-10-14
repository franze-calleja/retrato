import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MAX_COPIES, TRAY_MAX, clampCopies, trayCopies, traySheetItems, useTray, type TrayItem } from './tray'

const item = (n = 1): Omit<TrayItem, 'id'> => ({
  templateId: 'stamp', name: 'Stamp', edition: 'foil', url: `blob:${n}`, size: { w: 50, h: 62 }, copies: 1,
})

beforeEach(() => useTray.setState(useTray.getInitialState(), true))
afterEach(() => vi.restoreAllMocks())

test('add appends with a unique id and clamped copies', () => {
  expect(useTray.getState().add({ ...item(1), copies: 99 })).toBe(true)
  expect(useTray.getState().add({ ...item(2), copies: 0 })).toBe(true)
  const [a, b] = useTray.getState().items
  expect(a.id).not.toBe(b.id)
  expect([a.copies, b.copies]).toEqual([MAX_COPIES, 1])
})

test('the tray holds at most 20 entries', () => {
  for (let i = 0; i < TRAY_MAX; i++) expect(useTray.getState().add(item(i))).toBe(true)
  expect(useTray.getState().add(item(99))).toBe(false)
  expect(useTray.getState().items).toHaveLength(TRAY_MAX)
})

test('clampCopies keeps 1–20 and never NaN', () => {
  expect([clampCopies(0), clampCopies(3.6), clampCopies(50), clampCopies(NaN), clampCopies(Infinity)]).toEqual([1, 4, 20, 1, 1])
})

test('setCopies clamps', () => {
  useTray.getState().add(item())
  const id = useTray.getState().items[0].id
  useTray.getState().setCopies(id, 7)
  expect(useTray.getState().items[0].copies).toBe(7)
  useTray.getState().setCopies(id, -2)
  expect(useTray.getState().items[0].copies).toBe(1)
})

test('remove revokes that entry’s image URL', () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL')
  useTray.getState().add(item(1))
  useTray.getState().add(item(2))
  useTray.getState().remove(useTray.getState().items[0].id)
  expect(revoke).toHaveBeenCalledWith('blob:1')
  expect(useTray.getState().items.map((i) => i.url)).toEqual(['blob:2'])
})

test('clear revokes every URL, empties and hides the tray', () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL')
  useTray.getState().add(item(1))
  useTray.getState().add(item(2))
  useTray.getState().show()
  useTray.getState().clear()
  expect(revoke.mock.calls.map((c) => c[0])).toEqual(['blob:1', 'blob:2'])
  expect(useTray.getState()).toMatchObject({ items: [], open: false })
})

test('show and hide toggle the tray screen', () => {
  useTray.getState().show()
  expect(useTray.getState().open).toBe(true)
  useTray.getState().hide()
  expect(useTray.getState().open).toBe(false)
})

test('copies expand into sheet items in tray order', () => {
  useTray.getState().add({ ...item(1), copies: 2 })
  useTray.getState().add({ ...item(2), size: { w: 144, h: 60 } })
  const { items } = useTray.getState()
  expect(trayCopies(items)).toBe(3)
  expect(traySheetItems(items)).toEqual([
    { src: 'blob:1', w: 50, h: 62 }, { src: 'blob:1', w: 50, h: 62 }, { src: 'blob:2', w: 144, h: 60 },
  ])
})

test('the tray never touches storage', () => {
  const set = vi.spyOn(Storage.prototype, 'setItem')
  useTray.getState().add(item())
  useTray.getState().setCopies(useTray.getState().items[0].id, 3)
  useTray.getState().clear()
  expect(set).not.toHaveBeenCalled()
})
