// Short synthesized cues share a context and never require asset downloads.
export class RangeAudio {
  private context?: AudioContext

  play(pitch: number, duration = 0.075, wave: OscillatorType = 'triangle') {
    if (!navigator.userActivation?.hasBeenActive || typeof AudioContext === 'undefined') return
    this.context ??= new AudioContext()
    const ctx = this.context
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {})
      return
    }
    if (ctx.state !== 'running') return
    const tone = ctx.createOscillator(),
      gain = ctx.createGain()
    const t = ctx.currentTime
    tone.type = wave
    tone.frequency.setValueAtTime(pitch, t)
    tone.frequency.exponentialRampToValueAtTime(pitch * 0.4, t + duration)
    gain.gain.setValueAtTime(0.048, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    tone.connect(gain).connect(ctx.destination)
    tone.onended = () => {
      tone.disconnect()
      gain.disconnect()
    }
    tone.start()
    tone.stop(t + duration)
  }
}
