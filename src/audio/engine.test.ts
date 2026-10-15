import { afterEach, expect, test, vi } from 'vitest'
import { __setEngineForTest, getEngine, setLevels, unlock } from './engine'
import { FakeAudioContext, asAudio } from './fakeAudio'

afterEach(() => {
  __setEngineForTest(undefined)
  vi.unstubAllGlobals()
})

test('without Web Audio there is no engine and nothing throws', async () => {
  expect(getEngine()).toBeNull() // jsdom has no AudioContext
  expect(await unlock()).toBe(false)
  expect(() => setLevels({ music: 1, sfx: 1 })).not.toThrow()
})

test('a context that refuses to construct means no engine', () => {
  vi.stubGlobal('AudioContext', class { constructor() { throw new Error('blocked') } })
  expect(getEngine()).toBeNull()
})

test('music and effects run through master and a limiter to the speakers', () => {
  const fake = new FakeAudioContext()
  __setEngineForTest(asAudio(fake))
  const e = getEngine()!
  const limiter = fake.nodes.find((n) => n.kind === 'compressor')!
  expect(limiter.outputs).toContain(fake.destination)
  expect((e.master as unknown as { outputs: unknown[] }).outputs).toContain(limiter)
  expect((e.sfx as unknown as { outputs: unknown[] }).outputs).toContain(e.master)
  expect((e.music as unknown as { outputs: unknown[] }).outputs).toContain(e.musicMix)
  expect((e.musicMix as unknown as { outputs: unknown[] }).outputs).toContain(e.musicTone)
  expect((e.musicTone as unknown as { outputs: unknown[] }).outputs).toContain(e.master)
  expect(e.music.gain.value).toBe(0)
  expect(e.sfx.gain.value).toBe(0)
})

test('unlock starts audio; levels ramp both buses', async () => {
  const fake = new FakeAudioContext()
  __setEngineForTest(asAudio(fake))
  expect(await unlock()).toBe(true)
  expect(fake.state).toBe('running')
  setLevels({ music: 0.4, sfx: 0.7 })
  const e = getEngine()!
  expect(e.levels).toEqual({ music: 0.4, sfx: 0.7 })
  expect((e.music.gain as unknown as { events: { kind: string; value: number }[] }).events.at(-1)).toMatchObject({ kind: 'target', value: 0.4 })
  expect((e.sfx.gain as unknown as { events: { kind: string; value: number }[] }).events.at(-1)).toMatchObject({ kind: 'target', value: 0.7 })
})

test('a refused resume stays silent and the next gesture tries again', async () => {
  const fake = new FakeAudioContext()
  fake.resume = () => Promise.reject(new Error('no gesture'))
  __setEngineForTest(asAudio(fake))
  expect(await unlock()).toBe(false)
  fake.resume = () => { fake.state = 'running'; return Promise.resolve() }
  expect(await unlock()).toBe(true)
})
