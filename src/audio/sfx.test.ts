import { afterEach, beforeEach, expect, test } from 'vitest'
import { __setEngineForTest, getEngine } from './engine'
import { FakeAudioContext, FakeNode, asAudio } from './fakeAudio'
import { EDITION_SFX, MAX_VOICES, SFX_NAMES, play, renderSfx, type Sfx } from './sfx'

let fake: FakeAudioContext
beforeEach(() => {
  fake = new FakeAudioContext()
  fake.state = 'running'
  __setEngineForTest(asAudio(fake))
  getEngine()!.levels = { music: 0, sfx: 1 }
})
afterEach(() => __setEngineForTest(undefined))

test.each(SFX_NAMES.map((n) => [n] as const))('%s schedules sources that all stop by its length', (name: Sfx) => {
  const ctx = new FakeAudioContext()
  const v = renderSfx(asAudio(ctx), ctx.destination as unknown as AudioNode, name, 1, () => 0.5)
  const sources = ctx.sources()
  expect(sources.length).toBeGreaterThan(0)
  expect(v.length).toBeGreaterThan(0)
  expect(v.length).toBeLessThanOrEqual(1)
  for (const s of sources) {
    expect(s.startedAt!).toBeGreaterThanOrEqual(1)
    expect(s.stoppedAt!).toBeLessThanOrEqual(1 + v.length + 0.03)
  }
})

test('all 16 sounds exist, and editions map to rising arpeggios', () => {
  expect(SFX_NAMES).toHaveLength(16)
  expect(EDITION_SFX).toEqual({ foil: 'rare1', holo: 'rare2', poly: 'rare3' })
})

test('effects play into the effects bus', () => {
  expect(play('tick')).not.toBeNull()
  const out = getEngine()!.sfx as unknown as FakeNode
  const reaches = (n: FakeNode): boolean => n === out || n.outputs.some((o) => o instanceof FakeNode && reaches(o))
  expect(fake.sources().every((s) => reaches(s))).toBe(true)
})

test('nothing plays before unlock, when no engine exists, or when effects are muted', () => {
  fake.state = 'suspended'
  expect(play('tick')).toBeNull()
  fake.state = 'running'
  getEngine()!.levels = { music: 1, sfx: 0 }
  expect(play('tick')).toBeNull()
  __setEngineForTest(null)
  expect(play('tick')).toBeNull()
  expect(fake.sources()).toHaveLength(0)
})

test('the same sound within 40 ms is dropped', () => {
  expect(play('tick')).not.toBeNull()
  fake.currentTime = 0.03
  expect(play('tick')).toBeNull()
  fake.currentTime = 0.05
  expect(play('tick')).not.toBeNull()
})

test('at most six effects sound at once', () => {
  const names: Sfx[] = ['whirr', 'burst', 'chime', 'flash', 'tear', 'flip', 'confirm']
  const voices = names.map((n) => play(n))
  expect(voices.slice(0, MAX_VOICES).every(Boolean)).toBe(true)
  expect(voices[MAX_VOICES]).toBeNull()
  fake.currentTime = 2 // all finished
  expect(play('confirm')).not.toBeNull()
})

test('tick varies its pitch by at most 8 %', () => {
  for (const r of [0, 1]) {
    const ctx = new FakeAudioContext()
    renderSfx(asAudio(ctx), ctx.destination as unknown as AudioNode, 'tick', 0, () => r)
    const f = ctx.sources()[0].frequency.events[0].value
    expect(f).toBeGreaterThanOrEqual(1200 * 0.92 - 1e-9)
    expect(f).toBeLessThanOrEqual(1200 * 1.08 + 1e-9)
  }
})

test('stop() silences a voice now', () => {
  const v = play('whirr')!
  fake.currentTime = 0.2
  v.stop()
  for (const s of fake.sources()) expect(s.stoppedAt).toBe(0) // stop() with no time = immediately
})
