// One shared Web Audio graph: music and effects buses → master → limiter → speakers.
export interface Levels {
  music: number
  sfx: number
}

export interface Engine {
  ctx: AudioContext
  master: GainNode
  /** Music volume: operator level × guest mode. */
  music: GainNode
  /** Per-screen music mix (full / quiet / duck). */
  musicMix: GainNode
  musicTone: BiquadFilterNode
  sfx: GainNode
  levels: Levels
  /** End times of effects still sounding (voice cap). */
  voices: number[]
  /** When each effect last started (same-sound guard). */
  lastPlayed: Map<string, number>
}

let engine: Engine | null | undefined

function build(ctx: AudioContext): Engine {
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.25
  limiter.connect(ctx.destination)
  const master = ctx.createGain()
  master.connect(limiter)
  const sfx = ctx.createGain()
  sfx.gain.value = 0
  sfx.connect(master)
  const musicTone = ctx.createBiquadFilter()
  musicTone.type = 'lowpass'
  musicTone.frequency.value = 20000
  musicTone.connect(master)
  const musicMix = ctx.createGain()
  musicMix.connect(musicTone)
  const music = ctx.createGain()
  music.gain.value = 0
  music.connect(musicMix)
  return { ctx, master, music, musicMix, musicTone, sfx, levels: { music: 0, sfx: 0 }, voices: [], lastPlayed: new Map() }
}

function create(): Engine | null {
  const g = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }
  const Ctor = g.AudioContext ?? g.webkitAudioContext
  if (!Ctor) return null
  try {
    return build(new Ctor())
  } catch {
    return null
  }
}

/** The shared engine, or null when this browser has no usable Web Audio (the app then stays silent). */
export function getEngine(): Engine | null {
  if (engine === undefined) engine = create()
  return engine
}

/** True once a gesture has let audio start, while the tab isn't paused. */
export const isRunning = () => getEngine()?.ctx.state === 'running'

/** Called on taps and key presses (browsers only start audio from one). Resolves to whether audio now runs. */
export async function unlock(): Promise<boolean> {
  const e = getEngine()
  if (!e) return false
  if (e.ctx.state !== 'running') {
    try {
      await e.ctx.resume()
    } catch {
      // Try again on the next gesture.
    }
  }
  return e.ctx.state === 'running'
}

export function setLevels(levels: Levels) {
  const e = getEngine()
  if (!e) return
  e.levels = levels
  const now = e.ctx.currentTime
  e.music.gain.setTargetAtTime(levels.music, now, 0.05)
  e.sfx.gain.setTargetAtTime(levels.sfx, now, 0.05)
}

export async function suspend() {
  try {
    await getEngine()?.ctx.suspend()
  } catch {
    // Stays as it was.
  }
}

export async function resume() {
  try {
    await getEngine()?.ctx.resume()
  } catch {
    // The next gesture retries.
  }
}

/** Test seam: a fake context, null for "no Web Audio", or undefined to recreate lazily. */
export function __setEngineForTest(ctx: AudioContext | null | undefined) {
  engine = ctx ? build(ctx) : ctx
}
