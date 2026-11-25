// Procedural Web Audio API Sound Effects & Tier-Differentiated Result Jingles (Zero external files)
export class MiniGameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) {
    this.muted = Boolean(m);
  }

  _noiseBurst(duration, filterFreq, filterType = 'bandpass', vol = 0.28, q = 1.5, delaySec = 0) {
    const ctx = this._ensure();
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.value = filterFreq;
    flt.Q.value = q;

    const g = ctx.createGain();
    const t0 = ctx.currentTime + delaySec;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    src.connect(flt).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration);
  }

  _tone(freqStart, freqEnd, duration, type = 'triangle', vol = 0.25, delaySec = 0) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.02, duration * 0.2));
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // Butcher SEs
  playWash()     { this._noiseBurst(0.22, 1200, 'bandpass', 0.24, 0.9); }
  playSlice()    { this._noiseBurst(0.14, 2400, 'highpass', 0.30, 1.0); this._tone(320, 110, 0.10, 'sawtooth', 0.14); }
  playChop()     { this._tone(190, 55, 0.08, 'triangle', 0.34); this._noiseBurst(0.07, 1600, 'bandpass', 0.22, 1.5); }
  playPenPull()  { this._tone(240, 620, 0.28, 'sine', 0.22); this._noiseBurst(0.26, 900, 'bandpass', 0.14, 2.0); }
  playPop()      { this._tone(220, 520, 0.11, 'sine', 0.32); }
  playPeel()     { this._noiseBurst(0.25, 1800, 'bandpass', 0.26, 1.2); }
  playInkBurst() { this._noiseBurst(0.38, 420, 'lowpass', 0.42, 0.8); this._tone(140, 42, 0.32, 'sawtooth', 0.28); }

  // Cooking SEs
  playOilPour()  { this._tone(360, 520, 0.14, 'sine', 0.15); this._noiseBurst(0.14, 700, 'bandpass', 0.12, 3.0); }
  playSizzle()   { this._noiseBurst(0.35, 3200, 'highpass', 0.28, 0.7); }
  playSimmer()   { this._noiseBurst(0.16, 950, 'bandpass', 0.15, 2.2); }
  playToss()     { this._noiseBurst(0.20, 1500, 'bandpass', 0.24, 1.0); this._tone(160, 260, 0.14, 'triangle', 0.16); }
  playMillGrind(){ this._noiseBurst(0.11, 2100, 'bandpass', 0.26, 2.5); this._tone(150, 95, 0.09, 'sawtooth', 0.16); }
  playSprinkle() { this._noiseBurst(0.08, 4200, 'highpass', 0.18, 1.0); }

  // Feedback SEs
  playStepOK() {
    this._tone(587, 587, 0.10, 'triangle', 0.22, 0);
    this._tone(880, 880, 0.16, 'triangle', 0.22, 0.075);
  }
  playStepNG() {
    this._tone(210, 130, 0.24, 'sawtooth', 0.24, 0);
  }

  // 5-Tier Score-Differentiated Result Jingles (S+ / S / A / B / C)
  playResultJingle(rank) {
    if (rank === 'S+') {
      // Legendary Brass + Shimmering Arpeggio + Cymbal Crash!
      const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
      arp.forEach((f, i) => this._tone(f, f, 0.22, 'triangle', 0.22, i * 0.065));
      // Grand brass chord hit
      [261.63, 392.0, 523.25, 659.25, 1046.5].forEach((f) => {
        this._tone(f, f, 0.85, 'sawtooth', 0.11, 0.42);
        this._tone(f, f, 0.90, 'triangle', 0.16, 0.42);
      });
      this._noiseBurst(0.55, 5200, 'highpass', 0.22, 0.7, 0.42);
      // Sparkle chime tail
      this._tone(2093, 2093, 0.45, 'sine', 0.14, 0.56);
      this._tone(2637, 2637, 0.50, 'sine', 0.12, 0.68);
    } else if (rank === 'S') {
      // Celebratory High-Energy Victory Fanfare
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this._tone(f, f, 0.18, 'triangle', 0.24, i * 0.09);
      });
      [523.25, 659.25, 1046.5].forEach((f) => this._tone(f, f, 0.55, 'triangle', 0.18, 0.38));
      this._noiseBurst(0.28, 4500, 'highpass', 0.14, 0.9, 0.38);
      this._tone(1567.98, 1567.98, 0.35, 'sine', 0.14, 0.48);
    } else if (rank === 'A') {
      // Bright Upbeat 3-Note Clear Chime
      this._tone(440, 440, 0.14, 'triangle', 0.22, 0.0);
      this._tone(554.37, 554.37, 0.14, 'triangle', 0.22, 0.11);
      this._tone(659.25, 659.25, 0.32, 'triangle', 0.24, 0.22);
      this._tone(880, 880, 0.36, 'sine', 0.14, 0.24);
    } else if (rank === 'B') {
      // Calm Modest 2-Note Pass Tone
      this._tone(392.0, 392.0, 0.18, 'sine', 0.20, 0.0);
      this._tone(493.88, 493.88, 0.34, 'sine', 0.20, 0.18);
    } else {
      // Comedic Sad Trombone ("Wah-Wah-Waaah...") for Low Score (C / D)
      this._tone(311.13, 293.66, 0.28, 'sawtooth', 0.18, 0.0);
      this._tone(293.66, 277.18, 0.28, 'sawtooth', 0.18, 0.30);
      this._tone(277.18, 261.63, 0.28, 'sawtooth', 0.18, 0.60);
      this._tone(246.94, 210.0,  0.72, 'sawtooth', 0.20, 0.90);
      this._noiseBurst(0.32, 600, 'lowpass', 0.14, 0.8, 0.92);
    }
  }

  playFanfare(rank = 'S') {
    this.playResultJingle(rank);
  }
}
