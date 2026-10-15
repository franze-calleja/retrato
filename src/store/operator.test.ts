import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { OPERATOR_KEY, defaultSettings, loadIdleMinutes, loadMusicVolume, loadPaper, loadSettings, loadSfxVolume, loadShowSoundButton, sanitize, useOperator } from './operator'

beforeEach(() => {
  localStorage.clear()
  useOperator.getState().reset()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

test('defaults', () => {
  expect(defaultSettings()).toEqual({ weights: { common: 60, foil: 25, holo: 12, poly: 3 }, forced: 'random' })
})

test('setWeight and setForced persist; loadSettings restores them', () => {
  useOperator.getState().setWeight('holo', 50)
  useOperator.getState().setForced('poly')
  expect(JSON.parse(localStorage.getItem(OPERATOR_KEY)!)).toEqual({
    weights: { common: 60, foil: 25, holo: 50, poly: 3 },
    forced: 'poly',
    paper: 'a4',
    idleMinutes: 3,
    musicVolume: 40,
    sfxVolume: 70,
    showSoundButton: true,
  })
  expect(loadSettings()).toEqual({ weights: { common: 60, foil: 25, holo: 50, poly: 3 }, forced: 'poly' })
})

test('setWeight clamps to 0–100 and ignores unknown editions', () => {
  useOperator.getState().setWeight('foil', 500)
  useOperator.getState().setWeight('common', -3)
  useOperator.getState().setWeight('nope', 10)
  expect(useOperator.getState().weights).toEqual({ common: 0, foil: 100, holo: 12, poly: 3 })
})

test('setForced ignores unknown ids', () => {
  useOperator.getState().setForced('nope')
  expect(useOperator.getState().forced).toBe('random')
})

test('reset restores defaults and persists them', () => {
  useOperator.getState().setWeight('poly', 90)
  useOperator.getState().reset()
  expect(useOperator.getState().weights.poly).toBe(3)
  expect(loadSettings().weights.poly).toBe(3)
})

test('sanitize: corrupt shapes and values fall back per field', () => {
  expect(sanitize(null)).toEqual(defaultSettings())
  expect(sanitize('x')).toEqual(defaultSettings())
  expect(sanitize({ weights: { common: 'a', foil: -4, holo: 101, extra: 9 }, forced: 'nope' })).toEqual({
    weights: { common: 60, foil: 0, holo: 100, poly: 3 },
    forced: 'random',
  })
})

test('corrupt stored JSON loads defaults', () => {
  localStorage.setItem(OPERATOR_KEY, '{nope')
  expect(loadSettings()).toEqual(defaultSettings())
})

test('storage that throws never breaks reads or writes', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(loadSettings()).toEqual(defaultSettings())
  expect(() => useOperator.getState().setWeight('foil', 40)).not.toThrow()
  expect(useOperator.getState().weights.foil).toBe(40)
})

test('paper defaults to A4, persists, and restores', () => {
  expect(useOperator.getState().paper).toBe('a4')
  useOperator.getState().setPaper('letter')
  expect(useOperator.getState().paper).toBe('letter')
  expect(JSON.parse(localStorage.getItem(OPERATOR_KEY)!).paper).toBe('letter')
  expect(loadPaper()).toBe('letter')
})

test('unknown or corrupt paper falls back to A4', () => {
  useOperator.getState().setPaper('tabloid')
  expect(useOperator.getState().paper).toBe('a4')
  localStorage.setItem(OPERATOR_KEY, JSON.stringify({ paper: 42 }))
  expect(loadPaper()).toBe('a4')
  localStorage.setItem(OPERATOR_KEY, '{nope')
  expect(loadPaper()).toBe('a4')
})

test('reset puts paper back to A4', () => {
  useOperator.getState().setPaper('letter')
  useOperator.getState().reset()
  expect(useOperator.getState().paper).toBe('a4')
})

test('idle reset defaults to 3 minutes, persists, and rejects unknown values', () => {
  expect(useOperator.getState().idleMinutes).toBe(3)
  useOperator.getState().setIdleMinutes(0)
  expect(useOperator.getState().idleMinutes).toBe(0)
  expect(JSON.parse(localStorage.getItem(OPERATOR_KEY)!).idleMinutes).toBe(0)
  expect(loadIdleMinutes()).toBe(0)
  useOperator.getState().setIdleMinutes(7)
  expect(useOperator.getState().idleMinutes).toBe(0)
  localStorage.setItem(OPERATOR_KEY, JSON.stringify({ idleMinutes: 'x' }))
  expect(loadIdleMinutes()).toBe(3)
  useOperator.getState().reset()
  expect(useOperator.getState().idleMinutes).toBe(3)
})

test('settings saved under the old pixel-booth key carry over', () => {
  localStorage.setItem('pixel-booth:operator', JSON.stringify({ weights: { holo: 50 }, forced: 'foil', paper: 'letter', idleMinutes: 10 }))
  expect(loadSettings().forced).toBe('foil')
  expect(loadPaper()).toBe('letter')
  expect(loadIdleMinutes()).toBe(10)
  expect(OPERATOR_KEY).toBe('retrato:operator')
})

test('sound settings default to music 40, effects 70, speaker button shown', () => {
  const s = useOperator.getState()
  expect([s.musicVolume, s.sfxVolume, s.showSoundButton]).toEqual([40, 70, true])
})

test('sound settings persist, clamp to 0–100 and reset', () => {
  const s = useOperator.getState()
  s.setMusicVolume(55.4)
  s.setSfxVolume(250)
  s.setShowSoundButton(false)
  s.setMusicVolume(Number.NaN)
  const saved = JSON.parse(localStorage.getItem(OPERATOR_KEY)!)
  expect([saved.musicVolume, saved.sfxVolume, saved.showSoundButton]).toEqual([55, 100, false])
  expect([loadMusicVolume(), loadSfxVolume(), loadShowSoundButton()]).toEqual([55, 100, false])
  s.reset()
  const r = useOperator.getState()
  expect([r.musicVolume, r.sfxVolume, r.showSoundButton]).toEqual([40, 70, true])
})

test('settings saved before sound existed load with sound defaults', () => {
  localStorage.setItem(OPERATOR_KEY, JSON.stringify({ paper: 'letter', idleMinutes: 5 }))
  expect([loadMusicVolume(), loadSfxVolume(), loadShowSoundButton(), loadPaper()]).toEqual([40, 70, true, 'letter'])
})

test('hiding the speaker button gives the operator volumes back (a guest mute does not linger)', async () => {
  const { useSound } = await import('./sound')
  useSound.setState({ mode: 'off' })
  useOperator.getState().setShowSoundButton(false)
  expect(useSound.getState().mode).toBe('all')
})
