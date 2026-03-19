class SoundManager {
  private ctx: AudioContext | null = null
  private _muted: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      this._muted = localStorage.getItem('oripax-muted') === 'true'
    }
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    return this.ctx
  }

  get muted() {
    return this._muted
  }

  toggleMute() {
    this._muted = !this._muted
    if (typeof window !== 'undefined') {
      localStorage.setItem('oripax-muted', String(this._muted))
    }
    return this._muted
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
    if (this._muted) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  }

  coinInsert() {
    this.playTone(800, 0.1, 'square', 0.2)
    setTimeout(() => this.playTone(1200, 0.1, 'square', 0.2), 100)
    setTimeout(() => this.playTone(1600, 0.15, 'square', 0.2), 200)
  }

  ballDrop() {
    this.playTone(150, 0.3, 'sine', 0.4)
  }

  ballBounce() {
    this.playTone(400 + Math.random() * 200, 0.05, 'triangle', 0.15)
  }

  cardReveal() {
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.25), i * 80)
    })
  }

  rarePull() {
    const notes = [523, 659, 784, 1047, 1319]
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'triangle', 0.3), i * 120)
    })
  }

  jackpot() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568]
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.4, 'square', 0.2), i * 150)
    })
  }
}

export const soundManager = typeof window !== 'undefined'
  ? new SoundManager()
  : (null as unknown as SoundManager)
