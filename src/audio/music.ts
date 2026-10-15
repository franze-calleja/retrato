import { getEngine, type Engine } from './engine'

// An original slow, dreamy loop: detuned pads with a slow pitch wobble, a soft bass and a sparse melody.
export const BPM = 80
export const BEAT = 60 / BPM
export const BAR = BEAT * 4
/** Seconds ahead the scheduler looks on each tick. */
export const LOOKAHEAD = 0.12
export const TICK_MS = 25

interface Chord {
  name: string
  /** MIDI note of the bass. */
  bass: number
  /** MIDI notes of the pad voicing. */
  tones: readonly number[]
}
const DM9: Chord = { name: 'Dm9', bass: 38, tones: [50, 53, 57, 60, 64] }
const BBMAJ7: Chord = { name: 'B♭maj7', bass: 34, tones: [50, 53, 57, 58] }
const GM9: Chord = { name: 'Gm9', bass: 43, tones: [46, 50, 53, 55, 57] }
const A7SUS4: Chord = { name: 'A7sus4', bass: 45, tones: [52, 55, 57, 62] }
const A7: Chord = { name: 'A7', bass: 45, tones: [52, 55, 57, 61] }
export const PROGRESSION: readonly Chord[] = [DM9, DM9, BBMAJ7, BBMAJ7, GM9, GM9, A7SUS4, A7]

/** D minor pentatonic, octave 5. */
export const MELODY_NOTES = [74, 77, 79, 81, 84] as const
export const MELODY_CHANCE = 0.35

export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
/** Computed from the bar index, never accumulated, so the loop can't drift. */
export const barStart = (loopStart: number, bar: number) => loopStart + bar * BAR

function note(ctx: BaseAudioContext, out: AudioNode, nodes: AudioScheduledSourceNode[], type: OscillatorType, freq: number, t: number, dur: number, gain: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  g.connect(out)
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  o.connect(g)
  o.start(t)
  o.stop(t + dur + 0.02)
  nodes.push(o)
}

/** Schedules bar `bar` (the progression repeats every 8) from time t. Works on live and offline contexts. */
export function scheduleBar(ctx: BaseAudioContext, out: AudioNode, wobble: AudioNode | null, bar: number, t: number, rand: () => number) {
  const chord = PROGRESSION[bar % PROGRESSION.length]
  const nodes: AudioScheduledSourceNode[] = []
  // Pads: two detuned saws per chord tone, slow swell and release; the wobble LFO bends them together.
  const padEnd = t + BAR + 1.2
  const pad = ctx.createGain()
  pad.gain.setValueAtTime(0.0001, t)
  pad.gain.linearRampToValueAtTime(0.035, t + 0.8)
  pad.gain.setValueAtTime(0.035, t + BAR)
  pad.gain.linearRampToValueAtTime(0.0001, padEnd)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1400
  pad.connect(lp)
  lp.connect(out)
  for (const m of chord.tones) {
    for (const cents of [-7, 7]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(hz(m), t)
      o.detune.setValueAtTime(cents, t)
      wobble?.connect(o.detune)
      o.connect(pad)
      o.start(t)
      o.stop(padEnd + 0.05)
      nodes.push(o)
    }
  }
  for (const beat of [0, 2]) note(ctx, out, nodes, 'triangle', hz(chord.bass), t + beat * BEAT, 1.2, 0.22)
  for (let beat = 0; beat < 4; beat++) {
    if (rand() >= MELODY_CHANCE) continue
    const m = MELODY_NOTES[Math.floor(rand() * MELODY_NOTES.length)]
    note(ctx, out, nodes, 'square', hz(m), t + beat * BEAT, 0.35, 0.05)
  }
  return nodes
}

interface Session {
  ctx: AudioContext
  out: GainNode
  lfo: OscillatorNode
  wobble: GainNode
  loopStart: number
  nextBar: number
  timer: ReturnType<typeof setInterval>
  /** Sources of the last few bars, so stop can silence them. */
  bars: AudioScheduledSourceNode[][]
  rand: () => number
}
let session: Session | null = null

/** Schedules every bar starting inside the look-ahead window; a bar whose start already passed is skipped. */
function pump(s: Session) {
  const now = s.ctx.currentTime
  while (barStart(s.loopStart, s.nextBar) < now + LOOKAHEAD) {
    const t = barStart(s.loopStart, s.nextBar)
    if (t >= now) {
      s.bars.push(scheduleBar(s.ctx, s.out, s.wobble, s.nextBar, t, s.rand))
      if (s.bars.length > 3) s.bars.shift()
    }
    s.nextBar++
  }
}

/** Fades the loop in over 2 s. Does nothing without running audio or when already playing. */
export function startMusic(rand: () => number = Math.random) {
  const e = getEngine()
  if (!e || session || e.ctx.state !== 'running') return
  const ctx = e.ctx
  const now = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, now)
  out.gain.linearRampToValueAtTime(1, now + 2)
  out.connect(e.music)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.25
  const wobble = ctx.createGain()
  wobble.gain.value = 12 // ±12 cents
  lfo.connect(wobble)
  lfo.start(now)
  const s: Session = { ctx, out, lfo, wobble, loopStart: now + 0.05, nextBar: 0, bars: [], rand, timer: 0 as unknown as ReturnType<typeof setInterval> }
  session = s
  pump(s)
  s.timer = setInterval(() => pump(s), TICK_MS)
}

/** Fades out over 0.5 s and ends the loop. */
export function stopMusic() {
  const s = session
  if (!s) return
  session = null
  clearInterval(s.timer)
  const now = s.ctx.currentTime
  s.out.gain.cancelScheduledValues(now)
  s.out.gain.setValueAtTime(s.out.gain.value, now)
  s.out.gain.linearRampToValueAtTime(0.0001, now + 0.5)
  for (const n of [s.lfo, ...s.bars.flat()]) {
    try {
      n.stop(now + 0.55)
    } catch {
      // Already ended.
    }
  }
}

export const isMusicPlaying = () => session !== null

export type Mix = 'full' | 'quiet' | 'duck'
export const MIX = { full: { level: 1, tone: 20000 }, quiet: { level: 0.55, tone: 900 }, duck: { level: 0.3, tone: 0 } } as const
export const DUCK_MS = 1200
let base: Exclude<Mix, 'duck'> = 'full'
let duckTimer: ReturnType<typeof setTimeout> | undefined

function apply(e: Engine, mix: Mix) {
  const now = e.ctx.currentTime
  e.musicMix.gain.setTargetAtTime(MIX[mix].level, now, 0.15)
  e.musicTone.frequency.setTargetAtTime(mix === 'duck' ? MIX[base].tone : MIX[mix].tone, now, 0.15)
}

/** Screen mix (full in the shop, quiet elsewhere); duck dips under a loud effect, then returns. */
export function setMix(mix: Mix) {
  const e = getEngine()
  if (!e) return
  if (mix !== 'duck') base = mix
  clearTimeout(duckTimer)
  apply(e, mix)
  if (mix === 'duck') duckTimer = setTimeout(() => apply(e, base), DUCK_MS)
}
