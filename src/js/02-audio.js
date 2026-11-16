// ───────────────────────── Procedural sound synthesizer (Web Audio) ─────────────────────────
class SoundSynth {
  constructor() { this.ctx = null; this.musicOn = false; this.musicTimer = null; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 4;
    this.master = c.createGain();
    this.sfxBus = c.createGain(); this.musicBus = c.createGain();
    this.sfxBus.connect(this.master); this.musicBus.connect(this.master);
    this.master.connect(this.comp); this.comp.connect(c.destination);
    // soft reverb for sparkle & music
    this.verb = c.createConvolver(); this.verb.buffer = this.makeImpulse(2.2, 2.5);
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.28;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.applySettings();
    if (Settings.music) this.startMusic();
  }

  applySettings() {
    if (!this.ctx) return;
    this.master.gain.value = Settings.volume;
    this.sfxBus.gain.value = Settings.sfx ? 1 : 0;
    this.musicBus.gain.value = Settings.music ? 0.32 : 0;
    if (Settings.music && !this.musicOn) this.startMusic();
  }

  makeNoise(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  makeImpulse(sec, decay) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }

  get ok() { return this.ctx && this.ctx.state === 'running'; }

  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.3, attack = 0.005, when = 0, verb = 0, bus = null, detune = 0 }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    if (verb) { const vg = c.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.3, vol = 0.3, type = 'lowpass', f0 = 2000, f1 = 200, q = 1, when = 0, attack = 0.005 }) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ── Effects ──
  click() { this.tone({ type: 'triangle', f0: 900, f1: 1300, dur: 0.06, vol: 0.12 }); }
  hover() { this.tone({ type: 'sine', f0: 1500, f1: 1800, dur: 0.04, vol: 0.04 }); }
  squeak(p = 1) {
    const b = 700 * p * rand(0.9, 1.15);
    this.tone({ type: 'sine', f0: b, f1: b * 1.9, dur: 0.12, vol: 0.18 });
    this.tone({ type: 'triangle', f0: b * 1.9, f1: b * 1.3, dur: 0.14, vol: 0.12, when: 0.1 });
  }
  hurt() { const b = rand(800, 1000); this.tone({ type: 'square', f0: b, f1: b * 0.45, dur: 0.28, vol: 0.07 }); this.tone({ type: 'sine', f0: b * 1.2, f1: b * 0.5, dur: 0.3, vol: 0.15 }); }
  boing() { this.tone({ type: 'sine', f0: 220, f1: 660, dur: 0.18, vol: 0.2 }); this.tone({ type: 'triangle', f0: 330, f1: 990, dur: 0.15, vol: 0.06, when: 0.02 }); }
  land() { this.tone({ type: 'sine', f0: 180, f1: 70, dur: 0.12, vol: 0.18 }); this.noise({ dur: 0.08, vol: 0.06, f0: 900, f1: 200 }); }
  step() { this.tone({ type: 'sine', f0: 320 * rand(0.9, 1.1), f1: 200, dur: 0.05, vol: 0.05 }); }
  rustle() { this.noise({ dur: 0.18, vol: 0.12, type: 'bandpass', f0: 3000, f1: 6000, q: 0.8 }); this.noise({ dur: 0.12, vol: 0.08, type: 'highpass', f0: 5000, f1: 3000, when: 0.08 }); }
  cardFlip() { this.rustle(); this.tone({ type: 'triangle', f0: 600, f1: 1200, dur: 0.08, vol: 0.06, when: 0.05 }); }
  sparkle(n = 6, base = 1400) {
    for (let i = 0; i < n; i++) this.tone({ type: 'sine', f0: base * Math.pow(2, randi(0, 12) / 12) * (1 + i * 0.08), dur: 0.35, vol: 0.06, when: i * 0.05, verb: 0.8 });
  }
  chime() { [0, 4, 7, 12].forEach((s, i) => this.tone({ type: 'sine', f0: 880 * Math.pow(2, s / 12), dur: 0.6, vol: 0.09, when: i * 0.07, verb: 1 })); }
  whoosh() { this.noise({ dur: 0.35, vol: 0.18, type: 'bandpass', f0: 400, f1: 2400, q: 1.5 }); this.tone({ type: 'sine', f0: 300, f1: 900, dur: 0.2, vol: 0.08 }); }
  pop() { this.tone({ type: 'sine', f0: 500, f1: 1400, dur: 0.07, vol: 0.2 }); }
  tick(urgent) { this.tone({ type: 'square', f0: urgent ? 1400 : 1000, dur: 0.03, vol: 0.04 }); }
  explosion(size = 1) {
    this.noise({ dur: 0.9 * size, vol: 0.5, f0: 3000, f1: 80, q: 0.7 });
    this.tone({ type: 'sine', f0: 130, f1: 35, dur: 0.7 * size, vol: 0.55 });
    this.tone({ type: 'triangle', f0: 90, f1: 40, dur: 0.5, vol: 0.25, when: 0.03 });
    this.sparkle(4, 1800);
  }
  beam() { this.tone({ type: 'sawtooth', f0: 200, f1: 1200, dur: 1.0, vol: 0.06 }); this.tone({ type: 'sine', f0: 400, f1: 2400, dur: 1.0, vol: 0.1, verb: 0.6 }); this.noise({ dur: 1.0, vol: 0.12, type: 'bandpass', f0: 800, f1: 4000, q: 2 }); }
  rope() { this.tone({ type: 'triangle', f0: 1200, f1: 400, dur: 0.25, vol: 0.1 }); this.noise({ dur: 0.2, vol: 0.06, type: 'highpass', f0: 4000, f1: 2000 }); }
  nope() { this.tone({ type: 'square', f0: 330, f1: 220, dur: 0.22, vol: 0.09 }); this.tone({ type: 'square', f0: 260, f1: 160, dur: 0.3, vol: 0.09, when: 0.18 }); }
  alarm() { for (let i = 0; i < 4; i++) { this.tone({ type: 'square', f0: 880, dur: 0.12, vol: 0.06, when: i * 0.25 }); this.tone({ type: 'square', f0: 660, dur: 0.12, vol: 0.06, when: i * 0.25 + 0.12 }); } }
  defuse() { this.chime(); this.tone({ type: 'sine', f0: 600, f1: 300, dur: 0.6, vol: 0.12, when: 0.1 }); }
  heal() { [0, 3, 7, 10, 14].forEach((s, i) => this.tone({ type: 'sine', f0: 660 * Math.pow(2, s / 12), dur: 0.5, vol: 0.08, when: i * 0.06, verb: 1 })); }
  win() { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone({ type: 'triangle', f0: 523 * Math.pow(2, s / 12), dur: 0.35, vol: 0.13, when: i * 0.13, verb: 0.6 })); }
  turnStart() { this.tone({ type: 'sine', f0: 660, dur: 0.15, vol: 0.12, verb: 0.5 }); this.tone({ type: 'sine', f0: 990, dur: 0.25, vol: 0.12, when: 0.12, verb: 0.5 }); }
  gravity() { this.tone({ type: 'sine', f0: 900, f1: 120, dur: 1.2, vol: 0.15, verb: 1 }); this.tone({ type: 'sine', f0: 120, f1: 900, dur: 1.2, vol: 0.1, when: 0.2, verb: 1 }); }

  // ── Gentle music-box ambience ──
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const chords = [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]];
    const root = 349.23; // F4
    let bar = 0;
    const playBar = () => {
      if (!Settings.music) { this.musicOn = false; return; }
      const ch = chords[bar % chords.length];
      const B = this.musicBus;
      ch.forEach((s) => this.tone({ type: 'sine', f0: (root / 2) * Math.pow(2, s / 12), dur: 3.6, vol: 0.05, attack: 0.8, bus: B }));
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.25) continue;
        const s = ch[(i * 3 + bar) % 4] + (i % 3 === 2 ? 12 : 0);
        this.tone({ type: 'triangle', f0: root * 2 * Math.pow(2, s / 12), dur: 0.9, vol: 0.035, when: i * 0.45, bus: B, verb: 0.9 });
      }
      bar++;
      this.musicTimer = setTimeout(playBar, 3600);
    };
    playBar();
  }
}
const Sfx = new SoundSynth();
