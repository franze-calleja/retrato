import { beforeEach, expect, test } from 'vitest'
import { SOUND_KEY, effectiveLevels, loadMode, useSound } from './sound'

beforeEach(() => {
  localStorage.clear()
  useSound.getState().resetToDefault()
  localStorage.clear()
})

test('all on by default; cycling goes all → effects only → off → all and is saved', () => {
  expect(useSound.getState().mode).toBe('all')
  useSound.getState().cycle()
  expect(useSound.getState().mode).toBe('sfx')
  expect(JSON.parse(localStorage.getItem(SOUND_KEY)!)).toEqual({ mode: 'sfx' })
  useSound.getState().cycle()
  expect(useSound.getState().mode).toBe('off')
  useSound.getState().cycle()
  expect(useSound.getState().mode).toBe('all')
})

test('saved modes load; invalid ones fall back to all on', () => {
  localStorage.setItem(SOUND_KEY, JSON.stringify({ mode: 'off' }))
  expect(loadMode()).toBe('off')
  localStorage.setItem(SOUND_KEY, JSON.stringify({ mode: 'loud' }))
  expect(loadMode()).toBe('all')
  localStorage.setItem(SOUND_KEY, '{nope')
  expect(loadMode()).toBe('all')
})

test('resetToDefault turns sound back on for the next guest', () => {
  useSound.getState().cycle()
  useSound.getState().cycle()
  useSound.getState().resetToDefault()
  expect(useSound.getState().mode).toBe('all')
})

test('effective levels combine the guest mode with the operator volumes', () => {
  expect(effectiveLevels('all', 40, 70)).toEqual({ music: 0.4, sfx: 0.7 })
  expect(effectiveLevels('sfx', 40, 70)).toEqual({ music: 0, sfx: 0.7 })
  expect(effectiveLevels('off', 40, 70)).toEqual({ music: 0, sfx: 0 })
})
