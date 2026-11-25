// Procedural Web Audio API Sound Effects & Tier-Differentiated Result Jingles (Zero external files)
import { ensureAudioContext } from './SharedAudio.js';

export class MiniGameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensure() {
    if (this.muted) return null;
    this.ctx = ensureAudioContext();
    if (!this.ctx) return null;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(m) {
    this.muted = Boolean(m);
  }

  _noiseBurst(duration, filterFreq, filterType = 'bandpass', vol = 0.28, q = 1.5, delaySec = 0, dest = null) {
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

    src.connect(flt).connect(g).connect(dest || ctx.destination);
    src.start(t0);
    src.stop(t0 + duration);
  }

  _tone(freqStart, freqEnd, duration, type = 'triangle', vol = 0.25, delaySec = 0, dest = null, detuneCents = 0) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    if (detuneCents) osc.detune.setValueAtTime(detuneCents, t0);
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.02, duration * 0.2));
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g).connect(dest || ctx.destination);
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

  // ===========================================================================
  // 31m-50m: deep-sea discovery warnings (5 levels)
  // All alert sounds go through one gain node so a tap can fade them out.
  // ===========================================================================
  _alertBus() {
    const ctx = this._ensure();
    if (!ctx) return null;
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    // Gentle limiter so stacked layers never clip on phone speakers.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 8;
    bus.connect(comp).connect(ctx.destination);
    this.alertBus = bus;
    return bus;
  }

  stopColossalAlert() {
    const ctx = this.ctx;
    const bus = this.alertBus;
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(0.0001, now + 0.2);
    this.alertBus = null;
  }

  playColossalAlert(level = 1) {
    const bus = this._alertBus();
    if (!bus) return;
    if (level <= 1) {
      // 31-34m: two low sonar pings (220Hz -> 330Hz sine)
      this._tone(220, 220, 0.75, 'sine', 0.42, 0.0, bus);
      this._tone(330, 330, 0.95, 'sine', 0.42, 0.85, bus);
    } else if (level === 2) {
      // 35-39m: deep drone (65Hz saw) + 3 pulse beeps at 520Hz
      this._drone(65, 2.3, 0.30, bus);
      for (let i = 0; i < 3; i++) this._tone(520, 520, 0.16, 'square', 0.20, 0.25 + i * 0.32, bus);
    } else if (level === 3) {
      // 40-44m: alternating 620Hz / 460Hz alarm + 55Hz sub-bass hit
      for (let i = 0; i < 8; i++) this._tone(i % 2 ? 460 : 620, i % 2 ? 460 : 620, 0.28, 'square', 0.16, i * 0.3, bus);
      this._tone(110, 55, 0.9, 'sine', 0.55, 0.0, bus);
    } else if (level === 4) {
      // 45-49m: FM alarm sweeping 480Hz <-> 860Hz + metallic ring-out
      this._fmAlarm(480, 860, 2.6, bus);
      this._metalRing(0.1, bus);
      this._metalRing(1.4, bus);
    } else {
      // 50m MAX: full emergency siren + 60Hz sub + emergency chime
      this.playLeviathanSiren(this.ctx, bus);
    }
  }

  _drone(freq, duration, vol, dest) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.25);
    g.gain.setValueAtTime(vol, t0 + duration - 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(lp).connect(g).connect(dest);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  _fmAlarm(lowHz, highHz, duration, dest) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const carrier = ctx.createOscillator();
    carrier.type = 'sawtooth';
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = (highHz - lowHz) / 2;
    carrier.frequency.value = (highHz + lowHz) / 2;
    lfo.connect(lfoGain).connect(carrier.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.26, t0 + 0.08);
    g.gain.setValueAtTime(0.26, t0 + duration - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    carrier.connect(bp).connect(g).connect(dest);
    carrier.start(t0);
    lfo.start(t0);
    carrier.stop(t0 + duration + 0.05);
    lfo.stop(t0 + duration + 0.05);
  }

  _metalRing(delaySec, dest) {
    // Inharmonic partials = metallic "clang" with a long tail.
    [523, 1307, 2131, 3001].forEach((f, i) => this._tone(f, f * 0.995, 1.2 - i * 0.18, 'sine', 0.10 - i * 0.015, delaySec, dest));
  }

  // 50m MAX siren: 440Hz <-> 980Hz sweep x3 (3.2s), 60Hz sub-woofer, emergency chime.
  playLeviathanSiren(audioCtx = this.ctx, dest = null) {
    if (!audioCtx) return;
    const out = dest || audioCtx.destination;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    for (let i = 0; i < 3; i++) {
      const startTime = now + i * 1.0;
      osc.frequency.setValueAtTime(440, startTime);
      osc.frequency.linearRampToValueAtTime(980, startTime + 0.5);
      osc.frequency.linearRampToValueAtTime(440, startTime + 1.0);
    }
    // Low-pass keeps the saw from sounding harsh / clipping on small speakers.
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.1);
    gain.gain.setValueAtTime(0.32, now + 2.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
    osc.connect(lp).connect(gain).connect(out);
    osc.start(now);
    osc.stop(now + 3.2);

    const sub = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    sub.type = 'sine';
    sub.frequency.value = 60;
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.5, now + 0.15);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
    sub.connect(subGain).connect(out);
    sub.start(now);
    sub.stop(now + 3.25);

    // Emergency chime (descending triad) at the start and the end.
    [1318.5, 1046.5, 784].forEach((f, i) => {
      this._tone(f, f, 0.32, 'triangle', 0.16, 0.05 + i * 0.16, out);
      this._tone(f, f, 0.40, 'triangle', 0.14, 2.55 + i * 0.16, out);
    });
  }

  // Short cues for the 31m-50m boss actions during the fight.
  playColossalAction(actionName) {
    if (actionName === 'INK_BURST') {
      this.playInkBurst();
      this._noiseBurst(0.9, 260, 'lowpass', 0.32, 0.7, 0.12);
    } else if (actionName === 'ABYSSAL_PULSE') {
      for (let i = 0; i < 3; i++) this._tone(180, 720, 0.34, 'sine', 0.18, i * 0.38);
    } else if (actionName === 'SHIP_GRAB') {
      this._tone(90, 45, 0.7, 'sawtooth', 0.30);
      this._noiseBurst(0.6, 380, 'lowpass', 0.30, 0.8, 0.05);
      this._metalRingSimple(0.2);
    } else if (actionName === 'BEAK_SNAP') {
      this._noiseBurst(0.06, 2600, 'bandpass', 0.42, 2.0, 0.0);
      this._noiseBurst(0.06, 2400, 'bandpass', 0.42, 2.0, 0.28);
      this._tone(200, 70, 0.22, 'square', 0.18, 0.0);
    }
  }

  _metalRingSimple(delaySec) {
    const ctx = this._ensure();
    if (!ctx) return;
    this._metalRing(delaySec, ctx.destination);
  }

  // ===========================================================================
  // 31m-50m catch fanfares (1-30m keep playResultJingle unchanged)
  // ===========================================================================
  playColossalFanfare(lengthMeters, rank = 'SS') {
    const ctx = this._ensure();
    if (!ctx) return;
    const L = Math.round(lengthMeters);
    if (L < 31) { this.playResultJingle(rank); return; }

    const out = ctx.createGain();
    out.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    out.connect(comp).connect(ctx.destination);

    if (L <= 34) {
      // ~1.4s: S+ jingle with a low brass octave (130.8Hz / 196Hz) through an 800Hz low-pass.
      this.playResultJingle('S+');
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800;
      lp.connect(out);
      [130.81, 196.0].forEach((f) => {
        this._tone(f, f, 0.95, 'square', 0.14, 0.42, lp);
        this._tone(f, f, 0.95, 'sawtooth', 0.12, 0.42, lp);
      });
    } else if (L <= 39) {
      // ~1.8s: timpani roll -> 8-note rising arpeggio -> brass chord + cymbal.
      this._timpaniRoll(0, 0.35, 98, out);
      const arp = [261.63, 329.63, 392.0, 466.16, 523.25, 659.25, 783.99, 1046.5];
      arp.forEach((f, i) => this._tone(f, f, 0.18, 'triangle', 0.22, 0.38 + i * 0.07, out));
      this._brassChord([261.63, 329.63, 392.0, 523.25, 783.99], 0.98, 0.8, out);
      this._noiseBurst(0.8, 6000, 'highpass', 0.22, 0.7, 0.98, out);
    } else if (L <= 44) {
      // ~2.3s: two-step key change (C -> D), detuned brass, sparkle chimes.
      this._brassChord([261.63, 329.63, 392.0, 523.25], 0.0, 0.55, out, 12);
      this._brassChord([293.66, 369.99, 440.0, 587.33], 0.62, 0.55, out, 12);
      this._brassChord([293.66, 369.99, 440.0, 587.33, 880.0], 1.25, 1.0, out, 12);
      [1760, 2217.46, 2637.02, 3520, 2637.02, 3520].forEach((f, i) => this._tone(f, f, 0.3, 'sine', 0.09, 1.3 + i * 0.12, out));
      this._noiseBurst(0.7, 5800, 'highpass', 0.18, 0.7, 1.25, out);
    } else if (L <= 49) {
      // ~2.8s: snare roll -> triple brass hit (ta-ta-taan!) -> harp glissando with a long delay.
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.25;
      const fb = ctx.createGain();
      fb.gain.value = 0.4;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      delay.connect(fb).connect(delay);
      delay.connect(wet).connect(out);
      const send = ctx.createGain();
      send.connect(out);
      send.connect(delay);
      for (let i = 0; i < 14; i++) this._noiseBurst(0.05, 2400, 'bandpass', 0.14 + i * 0.012, 1.2, i * 0.045, send);
      this._brassChord([261.63, 392.0, 523.25], 0.7, 0.16, send);
      this._brassChord([261.63, 392.0, 523.25], 0.9, 0.16, send);
      this._brassChord([261.63, 329.63, 392.0, 523.25, 659.25], 1.1, 0.9, send);
      const harp = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 2093];
      harp.forEach((f, i) => this._tone(f, f, 0.5, 'triangle', 0.12, 1.55 + i * 0.05, send));
    } else {
      // ~3.6s: 50m grand fanfare — timpani hits, triple motif, 12-note golden arpeggio,
      // 7-voice detuned brass, double cymbal, 40Hz sub and a high bell tail, with reverb.
      const verb = ctx.createConvolver();
      verb.buffer = this._impulse(ctx, 2.2, 2.5);
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      verb.connect(wet).connect(out);
      const send = ctx.createGain();
      send.connect(out);
      send.connect(verb);
      [0, 0.18, 0.36, 0.5].forEach((d) => this._tone(98, 55, 0.4, 'sine', 0.5, d, send));
      [[392.0, 0.62], [392.0, 0.78], [523.25, 0.94]].forEach(([f, d]) => {
        this._tone(f, f, d === 0.94 ? 0.4 : 0.13, 'sawtooth', 0.12, d, send);
        this._tone(f, f, d === 0.94 ? 0.4 : 0.13, 'triangle', 0.18, d, send);
      });
      const gold = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093, 1567.98, 1318.51, 1567.98, 2093, 2637.02];
      gold.forEach((f, i) => this._tone(f, f, 0.2, 'triangle', 0.13, 1.4 + i * 0.06, send));
      this._brassChord([130.81, 196.0, 261.63, 329.63, 392.0, 523.25, 659.25], 2.15, 1.3, send, 10);
      this._tone(40, 40, 1.4, 'sine', 0.55, 2.1, send);
      this._noiseBurst(0.9, 6500, 'highpass', 0.24, 0.7, 2.15, send);
      this._noiseBurst(0.9, 6500, 'highpass', 0.20, 0.7, 2.45, send);
      [2093, 2637.02, 3135.96].forEach((f, i) => this._tone(f, f, 1.0, 'sine', 0.10, 2.6 + i * 0.1, send));
    }
  }

  _brassChord(freqs, delaySec, duration, dest, detune = 0) {
    freqs.forEach((f) => {
      this._tone(f, f, duration, 'sawtooth', 0.075, delaySec, dest, detune);
      if (detune) this._tone(f, f, duration, 'sawtooth', 0.065, delaySec, dest, -detune);
      this._tone(f, f, duration, 'triangle', 0.10, delaySec, dest);
    });
  }

  _timpaniRoll(delaySec, duration, freq, dest) {
    const hits = Math.max(4, Math.round(duration / 0.04));
    for (let i = 0; i < hits; i++) {
      const d = delaySec + (i / hits) * duration;
      this._tone(freq * 1.15, freq, 0.12, 'triangle', 0.12 + 0.2 * (i / hits), d, dest);
      this._noiseBurst(0.05, 180, 'lowpass', 0.10, 0.8, d, dest);
    }
  }

  _impulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
}
