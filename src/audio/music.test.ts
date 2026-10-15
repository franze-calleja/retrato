import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { __setEngineForTest, getEngine } from './engine'
import { FakeAudioContext, type FakeSource, asAudio } from './fakeAudio'
import { BAR, DUCK_MS, MELODY_NOTES, PROGRESSION, TICK_MS, hz, isMusicPlaying, scheduleBar, setMix, startMusic, stopMusic } from './music'

let fake: FakeAudioContext
beforeEach(() => {
  vi.useFakeTimers()
  fake = new FakeAudioContext()
  fake.state = 'running'
  __setEngineForTest(asAudio(fake))
})
afterEach(() => {
  stopMusic()
  setMix('full')
  vi.useRealTimers()
  __setEngineForTest(undefined)
})

const bass = (ctx: FakeAudioContext) => ctx.sources().filter((s) => s.type === 'triangle')
const never = () => 1 // rand ≥ MELODY_CHANCE: no melody notes

function advance(seconds: number) {
  for (let t = 0; t < seconds; t += TICK_MS / 1000) {
    fake.currentTime += TICK_MS / 1000
    vi.advanceTimersByTime(TICK_MS)
  }
}

test('the 8-bar progression is Dm9 Dm9 B♭maj7 B♭maj7 Gm9 Gm9 A7sus4 A7 and repeats', () => {
  expect(PROGRESSION.map((c) => c.name)).toEqual(['Dm9', 'Dm9', 'B♭maj7', 'B♭maj7', 'Gm9', 'Gm9', 'A7sus4', 'A7'])
  const ctx = new FakeAudioContext()
  scheduleBar(asAudio(ctx), ctx.destination as unknown as AudioNode, null, 10, 0, never) // bar 10 = bar 2
  expect(bass(ctx).map((s) => s.frequency.events[0].value)).toEqual([hz(34), hz(34)])
})

test('the melody follows the injected chance', () => {
  const always = new FakeAudioContext()
  scheduleBar(asAudio(always), always.destination as unknown as AudioNode, null, 0, 0, () => 0)
  const lead = always.sources().filter((s) => s.type === 'square')
  expect(lead).toHaveLength(4)
  expect(lead[0].frequency.events[0].value).toBe(hz(MELODY_NOTES[0]))
  const none = new FakeAudioContext()
  scheduleBar(asAudio(none), none.destination as unknown as AudioNode, null, 0, 0, never)
  expect(none.sources().filter((s) => s.type === 'square')).toHaveLength(0)
})

test('only the bar inside the look-ahead window is scheduled at first', () => {
  startMusic(never)
  expect(bass(fake)).toHaveLength(2)
})

test('100 loops later the bars still land exactly on the grid', () => {
  startMusic(never)
  const first = bass(fake)[0].startedAt!
  advance(100 * BAR)
  const starts = bass(fake).map((s: FakeSource) => s.startedAt!)
  expect(starts).toHaveLength(2 * 101)
  expect(starts.at(-2)!).toBeCloseTo(first + 100 * BAR, 9)
})

test('late bars are skipped, never played late', () => {
  startMusic(never)
  fake.currentTime = 10 // bars 1–3 started while the tab was paused
  vi.advanceTimersByTime(TICK_MS)
  expect(bass(fake)).toHaveLength(2)
  fake.currentTime = 12 // bar 4 starts at 12.05
  vi.advanceTimersByTime(TICK_MS)
  expect(bass(fake)).toHaveLength(4)
})

test('start and stop are idempotent; stopping ends the loop', () => {
  startMusic(never)
  startMusic(never)
  expect(fake.sources().filter((s) => s.frequency.value === 0.25)).toHaveLength(1) // one wobble LFO
  expect(isMusicPlaying()).toBe(true)
  stopMusic()
  stopMusic()
  expect(isMusicPlaying()).toBe(false)
  const count = fake.sources().length
  advance(2 * BAR)
  expect(fake.sources()).toHaveLength(count)
})

test('music waits for audio to be running', () => {
  fake.state = 'suspended'
  startMusic(never)
  expect(isMusicPlaying()).toBe(false)
})

test('mixes: full, quiet, and a duck that returns to the screen mix', () => {
  const mix = getEngine()!.musicMix.gain as unknown as { events: { value: number }[] }
  setMix('quiet')
  expect(mix.events.at(-1)!.value).toBe(0.55)
  setMix('duck')
  expect(mix.events.at(-1)!.value).toBe(0.3)
  vi.advanceTimersByTime(DUCK_MS)
  expect(mix.events.at(-1)!.value).toBe(0.55)
  setMix('full')
  expect(mix.events.at(-1)!.value).toBe(1)
})
