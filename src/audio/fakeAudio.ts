// Test-only stand-in for the Web Audio API: records nodes, connections and scheduled values.
export interface ParamEvent { kind: 'set' | 'linear' | 'exp' | 'target' | 'cancel'; value: number; time: number }

export class FakeParam {
  value: number
  events: ParamEvent[] = []
  constructor(value = 0) {
    this.value = value
  }
  private rec(kind: ParamEvent['kind'], value: number, time: number) {
    this.events.push({ kind, value, time })
    return this
  }
  setValueAtTime(v: number, t: number) { this.value = v; return this.rec('set', v, t) }
  linearRampToValueAtTime(v: number, t: number) { this.value = v; return this.rec('linear', v, t) }
  exponentialRampToValueAtTime(v: number, t: number) { this.value = v; return this.rec('exp', v, t) }
  setTargetAtTime(v: number, t: number) { this.value = v; return this.rec('target', v, t) }
  cancelScheduledValues(t: number) { return this.rec('cancel', 0, t) }
}

export class FakeNode {
  kind: string
  outputs: (FakeNode | FakeParam)[] = []
  constructor(kind: string) {
    this.kind = kind
  }
  connect<T extends FakeNode | FakeParam>(n: T): T {
    this.outputs.push(n)
    return n
  }
  disconnect() {
    this.outputs = []
  }
}

export class FakeSource extends FakeNode {
  type = 'sine'
  frequency = new FakeParam(440)
  detune = new FakeParam(0)
  playbackRate = new FakeParam(1)
  buffer: unknown = null
  loop = false
  startedAt: number | null = null
  stoppedAt: number | null = null
  start(t = 0) { this.startedAt = t }
  stop(t = 0) { this.stoppedAt = t }
}

export class FakeAudioContext {
  currentTime = 0
  sampleRate = 8000
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  destination = new FakeNode('destination')
  nodes: FakeNode[] = []
  private add<T extends FakeNode>(n: T): T {
    this.nodes.push(n)
    return n
  }
  createOscillator() { return this.add(new FakeSource('oscillator')) }
  createBufferSource() { return this.add(new FakeSource('buffer')) }
  createGain() { return this.add(Object.assign(new FakeNode('gain'), { gain: new FakeParam(1) })) }
  createBiquadFilter() {
    return this.add(Object.assign(new FakeNode('filter'), { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1) }))
  }
  createDynamicsCompressor() {
    return this.add(Object.assign(new FakeNode('compressor'), {
      threshold: new FakeParam(-24), knee: new FakeParam(30), ratio: new FakeParam(12), attack: new FakeParam(0.003), release: new FakeParam(0.25),
    }))
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length)
    return { length, sampleRate, getChannelData: () => data }
  }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
  /** Oscillators and buffer sources created so far. */
  sources() { return this.nodes.filter((n): n is FakeSource => n instanceof FakeSource) }
}

export const asAudio = (c: FakeAudioContext) => c as unknown as AudioContext
