/**
 * Synthetic sound effects using Web Audio API.
 * No audio files needed — all sounds generated programmatically.
 */
export default class SynthSFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.3;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Paint can pickup — bright rising chime */
  collectPaint() {
    this.ensure();
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    // Two quick rising tones
    [520, 780].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.08);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.3, t + i * 0.08 + 0.15);
      osc.connect(gain);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.2);
    });
  }

  /** Wall painted — spray + success jingle */
  paintWall() {
    this.ensure();
    const t = this.ctx.currentTime;

    // Spray noise
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + 0.4);
    filter.Q.value = 2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(this.volume * 0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);
    noise.stop(t + 0.5);

    // Success chime after spray
    const chimeGain = this.ctx.createGain();
    chimeGain.connect(this.ctx.destination);
    chimeGain.gain.setValueAtTime(0.001, t + 0.4);
    chimeGain.gain.linearRampToValueAtTime(this.volume * 0.4, t + 0.45);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

    [660, 830, 990].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(chimeGain);
      osc.start(t + 0.4 + i * 0.1);
      osc.stop(t + 0.4 + i * 0.1 + 0.3);
    });
  }

  /** Player caught by cop — alarm buzz */
  caught() {
    this.ensure();
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    // Low buzzing alarm
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.3);
    osc.frequency.linearRampToValueAtTime(180, t + 0.6);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  /** Step sound — soft tap */
  step() {
    this.ensure();
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 150 + Math.random() * 40;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /** Jump — quick whoosh up */
  jump() {
    this.ensure();
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(this.volume * 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Land — thud scaled by impact (0=soft, 1=heavy) */
  land(impact = 0.3) {
    this.ensure();
    const t = this.ctx.currentTime;
    const vol = this.volume * (0.1 + impact * 0.4);
    const dur = 0.08 + impact * 0.15;

    // Low thud
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80 + impact * 60, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + dur);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + dur);

    // Heavy landing: add noise-like crunch
    if (impact > 0.4) {
      const noiseGain = this.ctx.createGain();
      noiseGain.connect(this.ctx.destination);
      noiseGain.gain.setValueAtTime(vol * 0.6, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);

      const noise = this.ctx.createOscillator();
      noise.type = 'square';
      noise.frequency.setValueAtTime(50 + impact * 30, t);
      noise.frequency.exponentialRampToValueAtTime(25, t + dur * 0.7);
      noise.connect(noiseGain);
      noise.start(t);
      noise.stop(t + dur * 0.7);
    }
  }
}
