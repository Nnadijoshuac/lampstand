/**
 * Microphone -> speech segments -> text.
 * A segment ends at a short pause (or after MAX_SEC), so verses are not cut mid-word.
 * The engine is Underdog Bark, running natively in the desktop app (see BarkEngine below).
 */
export interface SttEngine {
  load(onProgress: (pct: number) => void): Promise<string>
  transcribe(samples: Float32Array): Promise<string>
}

const RATE = 16000
const FRAME = 1024 // 64 ms analysis frames
const PRE_ROLL_MS = 400 // audio kept from just before speech starts, so first words are not clipped
const END_SILENCE_MS = 600 // a pause this long ends a sentence
const MAX_SEC = 12 // longer runs are split at the quietest moment of the last few seconds
const MIN_SEC = 0.5
const INTERIM_MS = 450
const NOISE_FRAMES = Math.round((4 * RATE) / FRAME) // 4 s of history for the noise floor
const INTERIM_WINDOW = RATE * 5

/**
 * Turns the microphone into whole sentences for the recogniser.
 * - adaptive speech detection that tracks the room's noise floor
 * - pre-roll and trailing silence so words at the edges survive
 * - interim results re-read the whole sentence so far, then a final pass replaces them
 */
export class Listener {
  private ctx?: AudioContext
  private stream?: MediaStream
  private pending = new Float32Array(0)
  private preRoll: Float32Array[] = []
  private utter: Float32Array[] = []
  private utterLen = 0
  private frameRms: number[] = []
  private inSpeech = false
  private silentMs = 0
  private floor = 0.004
  private recentRms: number[] = []
  private busy = false
  private lastInterim = 0
  private queue: Float32Array[] = []

  constructor(private engine: SttEngine, private onText: (t: string) => void, private onLevel: (l: number) => void, private onInterim: (t: string) => void = () => {}) {}

  /** `feed`: a recording to listen to instead of the microphone (testing; nothing is played aloud). */
  async start(deviceId?: string, feed?: string): Promise<void> {
    this.ctx = new AudioContext({ sampleRate: RATE })
    let src: AudioNode
    if (feed) {
      const el = new Audio()
      el.crossOrigin = 'anonymous'
      el.src = feed
      el.onended = () => trace('feed end')
      src = this.ctx.createMediaElementSource(el)
      await el.play()
      trace('feed start ' + feed)
    } else {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } // Bark levels each clip itself
      })
      src = this.ctx.createMediaStreamSource(this.stream)
    }
    // Clean the signal before recognition: cut rumble below speech, and notch out 50 Hz mains hum and its overtones.
    const chain: AudioNode[] = [src]
    const highpass = this.ctx.createBiquadFilter()
    highpass.type = 'highpass'; highpass.frequency.value = 85; highpass.Q.value = 0.7
    chain.push(highpass)
    for (const f of [50, 100, 150, 200]) {
      const notch = this.ctx.createBiquadFilter()
      notch.type = 'notch'; notch.frequency.value = f; notch.Q.value = 25
      chain.push(notch)
    }
    const proc = this.ctx.createScriptProcessor(2048, 1, 1)
    proc.onaudioprocess = (e) => this.push(e.inputBuffer.getChannelData(0))
    chain.push(proc)
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1])
    proc.connect(this.ctx.destination)
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.ctx?.close()
    this.ctx = undefined
    if (this.utterLen) this.endUtterance()
  }

  private push(input: Float32Array): void {
    const all = new Float32Array(this.pending.length + input.length)
    all.set(this.pending); all.set(input, this.pending.length)
    let o = 0
    for (; o + FRAME <= all.length; o += FRAME) this.frame(all.slice(o, o + FRAME))
    this.pending = all.slice(o)
  }

  private frame(f: Float32Array): void {
    let sum = 0
    for (const s of f) sum += s * s
    const rms = Math.sqrt(sum / f.length)
    this.onLevel(Math.min(1, rms * 8))
    const ms = (FRAME / RATE) * 1000
    // Room noise level = the quietest stretch of the last few seconds (minimum statistics). Steady hum, fans
    // and hiss sit at that level and count as silence; speech has to rise clearly above it.
    this.recentRms.push(rms)
    if (this.recentRms.length > NOISE_FRAMES) this.recentRms.shift()
    const sorted = [...this.recentRms].sort((a, b) => a - b)
    this.floor = sorted[Math.floor(sorted.length * 0.1)] ?? rms
    const loud = rms > Math.max(0.004, this.floor * 2.8)

    if (!this.inSpeech) {
      this.preRoll.push(f)
      while (this.preRoll.length * ms > PRE_ROLL_MS) this.preRoll.shift()
      if (!loud) return
      this.inSpeech = true
      this.silentMs = 0
      for (const p of this.preRoll) this.add(p, 0)
      this.preRoll = []
      return
    }

    this.add(f, rms)
    this.silentMs = loud ? 0 : this.silentMs + ms
    const now = performance.now()
    if (this.silentMs >= END_SILENCE_MS) { if (this.utterLen / RATE >= MIN_SEC) this.endUtterance(); else this.reset(); return }
    if (this.utterLen / RATE >= MAX_SEC) { this.splitAtQuietest(); return }
    if (!this.busy && this.utterLen > RATE * 0.6 && now - this.lastInterim > INTERIM_MS) void this.interim()
  }

  private add(f: Float32Array, rms: number): void {
    this.utter.push(f); this.frameRms.push(rms); this.utterLen += f.length
  }

  private joined(frames = this.utter): Float32Array {
    const out = new Float32Array(frames.reduce((n, f) => n + f.length, 0))
    let o = 0
    for (const f of frames) { out.set(f, o); o += f.length }
    return out
  }

  private reset(): void {
    this.utter = []; this.frameRms = []; this.utterLen = 0; this.inSpeech = false; this.silentMs = 0
  }

  private endUtterance(): void {
    trace(`speech ended (${(this.utterLen / RATE).toFixed(1)}s of audio)`)
    this.queue.push(this.joined())
    this.reset()
    void this.drain()
  }

  /** Very long runs (a preacher who never pauses) are cut at the quietest frame of the last 3 s. */
  private splitAtQuietest(): void {
    const frames = this.utter.length
    const look = Math.min(frames - 1, Math.round((3 * RATE) / FRAME))
    let cut = frames - 1
    for (let i = frames - look; i < frames; i++) if (this.frameRms[i] < this.frameRms[cut]) cut = i
    const head = this.utter.slice(0, cut + 1), tail = this.utter.slice(cut + 1), tailRms = this.frameRms.slice(cut + 1)
    this.queue.push(this.joined(head))
    this.utter = tail; this.frameRms = tailRms; this.utterLen = tail.reduce((n, f) => n + f.length, 0)
    void this.drain()
  }

  private async interim(): Promise<void> {
    this.lastInterim = performance.now()
    this.busy = true
    try {
      // Interim results only need the latest words (to follow the reading), so read the last few seconds.
      const all = this.joined()
      const started = performance.now()
      const t = await this.engine.transcribe(all.length > INTERIM_WINDOW ? all.subarray(all.length - INTERIM_WINDOW) : all)
      trace(`interim ${Math.round(performance.now() - started)}ms`)
      if (t && this.inSpeech) this.onInterim(t)
    } catch { /* interim results are best effort */ } finally {
      this.busy = false
      void this.drain()
    }
  }

  private async drain(): Promise<void> {
    if (this.busy) return
    const next = this.queue.shift()
    if (!next) return
    this.busy = true
    try {
      const started = performance.now()
      const t = await this.engine.transcribe(next)
      trace(`final ${Math.round(performance.now() - started)}ms: ${t}`)
      if (t && !/^\[.*\]$|^\(.*\)$/.test(t)) this.onText(t)
    } catch { /* keep listening */ } finally {
      this.busy = false
      void this.drain()
    }
  }
}

/** Underdog Bark 3.0 Plus running natively in the desktop app (see src-tauri/src/bark.rs). */
export class BarkEngine implements SttEngine {
  async load(onProgress: (pct: number) => void): Promise<string> {
    const { invoke } = await import('@tauri-apps/api/core')
    for (let i = 0; ; i++) {
      const s = await invoke<string>('stt_status')
      if (s === 'ready') return 'bark'
      if (s !== 'loading' && s !== 'missing') throw new Error(s) // missing: waits for the models download
      onProgress(Math.min(95, i * 5))
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  async transcribe(samples: Float32Array): Promise<string> {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<string>('stt_transcribe', new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength))
  }
}

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const t0 = performance.now()
/** Timing diagnostics, written to %TEMP%/lampstand.log in the desktop app. */
export function trace(what: string): void {
  if (!isDesktop) return
  const line = `${((performance.now() - t0) / 1000).toFixed(2)}s ${what}`
  void import('@tauri-apps/api/core').then(({ invoke }) => invoke('log_line', { line })).catch(() => {})
}
