import { getEngine } from './engine'

export type Sfx =
  | 'tick' | 'hover' | 'reroll' | 'shake' | 'tear' | 'burst' | 'flip' | 'rare1' | 'rare2' | 'rare3'
  | 'shutter' | 'flash' | 'whirr' | 'chime' | 'confirm' | 'bonk'

export interface Voice {
  stop(): void
}

export const MAX_VOICES = 6
/** Seconds: the same effect again sooner than this is dropped so rapid taps stay crisp. */
export const REPEAT_GUARD = 0.04

/** Edition → reveal arpeggio (rarer editions get more notes). */
export const EDITION_SFX: Record<string, Sfx> = { foil: 'rare1', holo: 'rare2', poly: 'rare3' }

type Rand = () => number
interface Ctx {
  ctx: BaseAudioContext
  out: AudioNode
  t: number
  rand: Rand
  nodes: AudioScheduledSourceNode[]
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx)
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, b)
  }
  return b
}

/** Gain that rises to `peak` and decays to silence by `end`. */
function envelope(c: Ctx, peak: number, start: number, end: number, attack = 0.002): GainNode {
  const g = c.ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.linearRampToValueAtTime(peak, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, end)
  g.connect(c.out)
  return g
}

interface ToneOpts { type: OscillatorType; freq: number; to?: number; at?: number; dur: number; gain: number; attack?: number }
function tone(c: Ctx, o: ToneOpts) {
  const start = c.t + (o.at ?? 0)
  const end = start + o.dur
  const osc = c.ctx.createOscillator()
  osc.type = o.type
  osc.frequency.setValueAtTime(o.freq, start)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, end)
  osc.connect(envelope(c, o.gain, start, end, o.attack))
  osc.start(start)
  osc.stop(end + 0.02)
  c.nodes.push(osc)
}

interface NoiseOpts { at?: number; dur: number; gain: number; filter: BiquadFilterType; freq: number; to?: number; q?: number; attack?: number }
function noise(c: Ctx, o: NoiseOpts) {
  const start = c.t + (o.at ?? 0)
  const end = start + o.dur
  const src = c.ctx.createBufferSource()
  src.buffer = noiseBuffer(c.ctx)
  const f = c.ctx.createBiquadFilter()
  f.type = o.filter
  f.frequency.setValueAtTime(o.freq, start)
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, end)
  if (o.q) f.Q.value = o.q
  src.connect(f)
  f.connect(envelope(c, o.gain, start, end, o.attack))
  src.start(start)
  src.stop(end + 0.02)
  c.nodes.push(src)
}

/** The same context, but sounding through a lowpass filter. */
function lowpassed(c: Ctx, freq: number): Ctx {
  const f = c.ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = freq
  f.connect(c.out)
  return { ...c, out: f }
}

function arpeggio(c: Ctx, count: number) {
  const notes = [72, 76, 79, 84, 88, 91].slice(0, count) // C5 E5 G5 C6 E6 G6
  notes.forEach((m, i) => tone(c, { type: 'square', freq: hz(m), at: i * 0.07, dur: 0.12, gain: 0.1 }))
  return (count - 1) * 0.07 + 0.12
}

// Each recipe schedules its sources from c.t and returns its length in seconds.
const RECIPES: Record<Sfx, (c: Ctx) => number> = {
  tick: (c) => {
    tone(c, { type: 'square', freq: 1200 * (0.92 + c.rand() * 0.16), dur: 0.04, gain: 0.18 })
    return 0.045
  },
  hover: (c) => {
    tone(c, { type: 'triangle', freq: 2400, dur: 0.025, gain: 0.06 })
    return 0.03
  },
  reroll: (c) => {
    ;[84, 86, 88, 91, 93, 96].forEach((m, i) => tone(c, { type: 'square', freq: hz(m), at: i * 0.03, dur: 0.05, gain: 0.12 }))
    return 0.2
  },
  shake: (c) => {
    for (let i = 0; i < 4; i++) noise(c, { at: i * 0.06, dur: 0.05, gain: 0.25, filter: 'bandpass', freq: 800, q: 4 })
    return 0.26
  },
  tear: (c) => {
    noise(c, { dur: 0.22, gain: 0.3, filter: 'highpass', freq: 600, to: 4000, attack: 0.01 })
    return 0.22
  },
  burst: (c) => {
    ;[72, 76, 79, 83].forEach((m, i) => tone(c, { type: 'triangle', freq: hz(m), at: i * 0.015, dur: 0.6, gain: 0.1 }))
    for (let i = 0; i < 3; i++)
      tone(c, { type: 'square', freq: hz(96 + Math.floor(c.rand() * 5) * 2), at: 0.25 + i * 0.08, dur: 0.08, gain: 0.05 })
    return 0.7
  },
  flip: (c) => {
    noise(c, { dur: 0.2, gain: 0.2, filter: 'lowpass', freq: 3000, to: 800, attack: 0.02 })
    tone(c, { type: 'triangle', freq: 140, to: 90, at: 0.12, dur: 0.12, gain: 0.3 })
    return 0.25
  },
  rare1: (c) => arpeggio(c, 3),
  rare2: (c) => arpeggio(c, 4),
  rare3: (c) => arpeggio(c, 6),
  shutter: (c) => {
    noise(c, { dur: 0.03, gain: 0.3, filter: 'highpass', freq: 2000 })
    noise(c, { at: 0.07, dur: 0.04, gain: 0.25, filter: 'highpass', freq: 2000 })
    tone(c, { type: 'sine', freq: 90, dur: 0.1, gain: 0.4 })
    return 0.15
  },
  flash: (c) => {
    tone(c, { type: 'sine', freq: 3000, to: 300, dur: 0.3, gain: 0.15 })
    noise(c, { dur: 0.25, gain: 0.08, filter: 'highpass', freq: 5000 })
    return 0.3
  },
  whirr: (c) => {
    // Motor: a buzzy saw through a lowpass, with a fast tremolo.
    const end = c.t + 0.9
    const lp = lowpassed({ ...c, out: envelope(c, 0.12, c.t, end, 0.1) }, 500)
    const trem = c.ctx.createGain()
    trem.gain.value = 0.5
    trem.connect(lp.out)
    const osc = c.ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(70, c.t)
    osc.connect(trem)
    const lfo = c.ctx.createOscillator()
    lfo.frequency.setValueAtTime(20, c.t)
    const depth = c.ctx.createGain()
    depth.gain.value = 0.5
    lfo.connect(depth)
    depth.connect(trem.gain)
    for (const s of [osc, lfo]) {
      s.start(c.t)
      s.stop(end + 0.02)
      c.nodes.push(s)
    }
    return 0.9
  },
  chime: (c) => {
    tone(c, { type: 'triangle', freq: hz(79), dur: 0.5, gain: 0.15 })
    tone(c, { type: 'triangle', freq: hz(84), at: 0.12, dur: 0.48, gain: 0.15 })
    return 0.6
  },
  confirm: (c) => {
    tone(c, { type: 'square', freq: hz(88), dur: 0.07, gain: 0.1 })
    tone(c, { type: 'square', freq: hz(95), at: 0.06, dur: 0.09, gain: 0.1 })
    return 0.15
  },
  bonk: (c) => {
    const lp = lowpassed(c, 1200)
    tone(lp, { type: 'square', freq: hz(50), dur: 0.1, gain: 0.15 })
    tone(lp, { type: 'square', freq: hz(45), at: 0.09, dur: 0.15, gain: 0.15 })
    return 0.25
  },
}

export const SFX_NAMES = Object.keys(RECIPES) as Sfx[]

/** Schedules one effect on any context, live or offline (the listening preview uses this too). */
export function renderSfx(ctx: BaseAudioContext, out: AudioNode, name: Sfx, t: number, rand: Rand = Math.random): Voice & { length: number } {
  const c: Ctx = { ctx, out, t, rand, nodes: [] }
  const length = RECIPES[name](c)
  let stopped = false
  return {
    length,
    stop() {
      if (stopped) return
      stopped = true
      for (const n of c.nodes) {
        try {
          n.stop()
        } catch {
          // Already ended.
        }
      }
    },
  }
}

/** Plays an effect now; null (and silence) when audio is locked, muted, too busy or just played. */
export function play(name: Sfx, opts: { rand?: Rand } = {}): Voice | null {
  const e = getEngine()
  if (!e || e.ctx.state !== 'running' || e.levels.sfx <= 0) return null
  const now = e.ctx.currentTime
  const last = e.lastPlayed.get(name)
  if (last !== undefined && now - last < REPEAT_GUARD) return null
  e.voices = e.voices.filter((end) => end > now)
  if (e.voices.length >= MAX_VOICES) return null
  const voice = renderSfx(e.ctx, e.sfx, name, now, opts.rand)
  e.lastPlayed.set(name, now)
  e.voices.push(now + voice.length)
  return voice
}
