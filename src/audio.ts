export class AudioBus {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private lastHit = 0

  ensure(): void {
    if (!this.ctx) {
      const ctx = new AudioContext()
      const master = ctx.createGain()
      master.gain.value = 0.32
      master.connect(ctx.destination)
      const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.ctx = ctx
      this.master = master
      this.noise = noise
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  hit(): void {
    if (!this.ctx || !this.master || !this.noise) return
    const now = this.ctx.currentTime
    if (now - this.lastHit < 0.09) return
    this.lastHit = now
    this.burst(1800, 0.045, 0.045, 700)
  }

  break(rare: boolean): void {
    if (!this.ctx) return
    this.burst(rare ? 900 : 420, rare ? 0.12 : 0.09, rare ? 0.12 : 0.08, rare ? 400 : 180)
    if (rare) this.tone(880, 0.12, 'sine', 0.05)
  }

  sell(): void {
    if (!this.ctx || !this.master) return
    for (let i = 0; i < 4; i++) this.tone(720 + i * 140, 0.05, 'square', 0.025, i * 0.045)
  }

  buy(): void {
    this.tone(160, 0.16, 'sine', 0.07)
    this.tone(240, 0.18, 'triangle', 0.04, 0.02)
  }

  deny(): void {
    this.tone(90, 0.08, 'square', 0.03)
  }

  pulse(): void {
    this.burst(240, 0.22, 0.16, 80)
    this.tone(70, 0.2, 'sine', 0.08)
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const amp = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(amp)
    amp.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private burst(freq: number, dur: number, gain: number, band: number): void {
    if (!this.ctx || !this.master || !this.noise) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(freq, t)
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, band), t + dur)
    filter.Q.value = 0.7
    const amp = this.ctx.createGain()
    amp.gain.setValueAtTime(gain, t)
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(filter)
    filter.connect(amp)
    amp.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }
}
