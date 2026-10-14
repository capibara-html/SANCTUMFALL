// Procedural sound: every effect and the ambient drone are synthesised with
// WebAudio at runtime, so the game ships without audio files. Replace any
// entry in SFX with a sample player later without touching game code.

type Voice = (a: AudioEngine, t: number) => void;

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  private drone: { stop(): void } | null = null;
  muted = false;
  private last = new Map<string, number>();

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  play(id: string): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const prev = this.last.get(id) ?? 0;
    if (now - prev < 0.04) return; // avoid stacking identical sounds
    this.last.set(id, now);
    SFX[id]?.(this, now);
  }

  // --- building blocks -------------------------------------------------------
  osc(type: OscillatorType, freq: number, t: number, dur: number, vol: number, freqEnd?: number, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(t: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, freqEnd?: number, q = 1): void {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
  }

  /** Inharmonic partials: a church bell. */
  bell(t: number, base: number, vol: number, dur = 2.5): void {
    for (const [ratio, v] of [[0.5, 0.5], [1, 1], [1.19, 0.5], [1.56, 0.35], [2, 0.4], [2.66, 0.2], [3.01, 0.12]] as const) this.osc('sine', base * ratio, t, dur * (1.2 - ratio * 0.15), vol * v);
  }

  /** Open-fifth choir pad through a vowel-ish band-pass. */
  choir(t: number, root: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 800;
    f.Q.value = 2;
    f.connect(this.master!);
    for (const r of [1, 1.5, 2, 3]) for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = root * r;
      o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  startDrone(region: 'ash' | 'drowned' | 'title'): void {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopDrone();
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(region === 'title' ? 0.16 : 0.12, ctx.currentTime, 1.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = region === 'drowned' ? 420 : 300;
    out.connect(this.master!);
    lp.connect(out);
    const root = region === 'drowned' ? 49 : region === 'ash' ? 55 : 41.2;
    const nodes: OscillatorNode[] = [];
    for (const [r, type, det] of [[1, 'sawtooth', -6], [1, 'sawtooth', 6], [1.5, 'triangle', 0], [2, 'sine', 3], [2.38, 'sine', -3]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = root * r;
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.value = r === 1 ? 0.35 : 0.18;
      o.connect(g).connect(lp);
      o.start();
      nodes.push(o);
    }
    // slow breathing of the filter
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 0.07;
    lg.gain.value = 140;
    lfo.connect(lg).connect(lp.frequency);
    lfo.start();
    nodes.push(lfo);
    // distant bell every so often
    const timer = window.setInterval(() => {
      if (!this.muted && this.ctx) this.bell(this.ctx.currentTime, root * 4, 0.05, 4);
    }, region === 'title' ? 9000 : 17000);
    this.drone = {
      stop: () => {
        window.clearInterval(timer);
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.4);
        for (const n of nodes) n.stop(t + 2);
      },
    };
  }

  stopDrone(): void {
    this.drone?.stop();
    this.drone = null;
  }
}

const SFX: Record<string, Voice> = {
  ui: (a, t) => a.osc('square', 660, t, 0.05, 0.04, 520),
  select: (a, t) => { a.osc('triangle', 520, t, 0.08, 0.08, 780); a.osc('sine', 1040, t + 0.03, 0.1, 0.03); },
  cancel: (a, t) => a.osc('triangle', 500, t, 0.08, 0.06, 300),
  step: (a, t) => a.noise(t, 0.05, 0.08, 'lowpass', 500),
  flail: (a, t) => { a.noise(t, 0.18, 0.3, 'bandpass', 900, 300, 2); a.osc('square', 140, t, 0.12, 0.12, 60); },
  claw: (a, t) => a.noise(t, 0.16, 0.25, 'highpass', 2500, 900),
  hit: (a, t) => { a.noise(t, 0.14, 0.3, 'lowpass', 1800, 200); a.osc('sine', 110, t, 0.15, 0.25, 50); },
  hurt: (a, t) => { a.noise(t, 0.18, 0.3, 'lowpass', 1400, 200); a.osc('sawtooth', 180, t, 0.2, 0.1, 90); },
  push: (a, t) => a.noise(t, 0.16, 0.18, 'lowpass', 700, 120),
  bump: (a, t) => { a.osc('sine', 80, t, 0.22, 0.4, 40); a.noise(t, 0.1, 0.25, 'lowpass', 1200); },
  charge: (a, t) => a.noise(t, 0.3, 0.2, 'bandpass', 300, 1400, 1.5),
  roar: (a, t) => { a.osc('sawtooth', 90, t, 0.35, 0.12, 60); a.noise(t, 0.35, 0.12, 'bandpass', 400, 200, 3); },
  chain: (a, t) => { for (let i = 0; i < 5; i++) a.osc('square', 1800 + i * 230, t + i * 0.025, 0.04, 0.03); },
  hallow: (a, t) => { a.bell(t, 660, 0.08, 1.6); a.choir(t, 220, 1.2, 0.03); },
  ward: (a, t) => { a.osc('sine', 1320, t, 0.4, 0.06, 1760); a.osc('sine', 1980, t + 0.05, 0.4, 0.03); },
  rebuke: (a, t) => { a.osc('triangle', 300, t, 0.3, 0.1, 900); a.bell(t + 0.12, 880, 0.04, 0.8); },
  bile: (a, t) => { a.noise(t, 0.4, 0.15, 'bandpass', 300, 800, 4); a.osc('sine', 200, t + 0.38, 0.2, 0.15, 60); },
  chant: (a, t) => { a.choir(t, 73.4, 1.0, 0.05); a.osc('sawtooth', 73.4, t, 0.9, 0.05, 69); },
  tide: (a, t) => { a.noise(t, 0.9, 0.3, 'lowpass', 300, 1500, 0.7); a.osc('sine', 55, t, 0.9, 0.25, 40); },
  maw: (a, t) => { a.osc('sawtooth', 70, t, 0.5, 0.2, 35); a.noise(t + 0.1, 0.25, 0.4, 'lowpass', 2000, 200); },
  surface: (a, t) => { a.noise(t, 1.0, 0.25, 'lowpass', 200, 900, 0.7); a.osc('sine', 41, t, 1, 0.3, 30); },
  warded: (a, t) => a.bell(t, 330, 0.07, 1.2),
  death: (a, t) => { a.osc('sawtooth', 420, t, 0.35, 0.08, 70); a.noise(t, 0.4, 0.15, 'bandpass', 1200, 300, 3); },
  fall: (a, t) => { a.bell(t, 110, 0.15, 3); a.osc('sine', 82, t, 1.4, 0.15); },
  crumble: (a, t) => a.noise(t, 0.5, 0.25, 'lowpass', 900, 100),
  drown: (a, t) => { for (let i = 0; i < 6; i++) a.osc('sine', 300 + Math.random() * 400, t + i * 0.05, 0.08, 0.06, 700); a.noise(t, 0.4, 0.15, 'lowpass', 600); },
  taint: (a, t) => a.noise(t, 0.12, 0.05, 'bandpass', 3000, 1000, 6),
  spawn: (a, t) => { a.osc('sawtooth', 60, t, 0.5, 0.15, 110); a.noise(t, 0.5, 0.15, 'bandpass', 200, 600, 4); },
  blocked: (a, t) => a.osc('triangle', 220, t, 0.15, 0.08, 160),
  seal: (a, t) => { a.bell(t, 196, 0.22, 4); a.choir(t + 0.1, 98, 2.6, 0.05); },
  desecrate: (a, t) => { a.osc('sawtooth', 110, t, 0.8, 0.1, 55); a.noise(t, 0.6, 0.12, 'bandpass', 500, 150, 4); },
  turn: (a, t) => a.bell(t, 392, 0.05, 1.4),
  reckoning: (a, t) => { a.bell(t, 147, 0.12, 2.5); },
  victory: (a, t) => { a.choir(t, 130.8, 3.5, 0.06); a.bell(t, 261.6, 0.15, 4); a.bell(t + 0.6, 392, 0.1, 4); },
  defeat: (a, t) => { a.bell(t, 98, 0.2, 5); a.bell(t + 1.4, 92.5, 0.15, 5); a.osc('sine', 49, t, 3, 0.2); },
};

export const audio = new AudioEngine();
