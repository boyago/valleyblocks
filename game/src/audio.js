const clamp = (number, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(Number(number)) ? Number(number) : min));
const midi = note => 440 * 2 ** ((note - 69) / 12);
const point = value => Array.isArray(value) ? value : [value?.x || 0, value?.y || 0, value?.z || 0];

/** Procedural effects and an original piano miniature: no downloaded audio assets. */
export class GameAudio {
  constructor(settings = {}) {
    this.musicVolume = clamp(settings.music ?? settings.musicVolume ?? 0.3);
    this.effectsVolume = clamp(settings.effects ?? settings.effectsVolume ?? 0.65);
    this.context = null;
    this.paused = false;
    this.voices = new Set();
    this.elapsed = 0;
    this.stepTime = 0;
    this.ambientTime = 4;
    this.musicTime = 3;
    this.musicNote = 0;
    this.musicPhrase = 0;
    this.engineSpeed = 0;
    this.lastEngineTime = -1;
    this.breathTime = 0;
  }

  async init() {
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContextClass();
      const ctx = this.context;
      this.master = ctx.createGain();
      this.master.gain.value = 0.75;
      this.master.connect(ctx.destination);
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = this.paused ? 0 : this.musicVolume;
      this.musicGain.connect(this.master);
      this.effectsGain = ctx.createGain();
      this.effectsGain.gain.value = this.effectsVolume;
      this.effectsGain.connect(this.master);
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const samples = this.noiseBuffer.getChannelData(0);
      let previous = 0;
      // Smoothed noise avoids sharp high-frequency hiss in soft ambience.
      for (let i = 0; i < samples.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.12) / 1.04;
        samples[i] = previous * 2;
      }
      this.createEnvironment();
      this.createEngine();
    }
    if (this.context.state === 'suspended' && !this.paused) await this.context.resume();
    return true;
  }

  createEnvironment() {
    const ctx = this.context;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = this.noiseBuffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 480;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = this.paused ? 0 : 0.032;
    this.windSource.connect(this.windFilter).connect(this.windGain).connect(this.effectsGain);
    this.windSource.start();
    this.waterSource = ctx.createBufferSource();
    this.waterSource.buffer = this.noiseBuffer;
    this.waterSource.loop = true;
    this.waterSource.playbackRate.value = 1.7;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    this.waterPanner = this.makePanner([0, 0, 0]);
    this.waterSource.connect(this.waterGain).connect(this.waterPanner).connect(this.effectsGain);
    this.waterSource.start();
  }

  createEngine() {
    const ctx = this.context;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 42;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 190;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.enginePanner = this.makePanner([0, 0, 0]);
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.enginePanner).connect(this.effectsGain);
    this.engineOsc.start();
  }

  setVolumes(music, effects) {
    this.musicVolume = clamp(music);
    this.effectsVolume = clamp(effects);
    if (!this.context) return;
    const now = this.context.currentTime;
    this.musicGain.gain.setTargetAtTime(this.paused ? 0 : this.musicVolume, now, 0.08);
    this.effectsGain.gain.setTargetAtTime(this.effectsVolume, now, 0.08);
  }

  makePanner(position) {
    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3;
    panner.maxDistance = 48;
    panner.rolloffFactor = 1.3;
    this.movePanner(panner, position);
    return panner;
  }

  movePanner(panner, position) {
    const [x, y, z] = point(position);
    if (panner.positionX) {
      const now = this.context.currentTime;
      panner.positionX.setTargetAtTime(x, now, 0.04);
      panner.positionY.setTargetAtTime(y, now, 0.04);
      panner.positionZ.setTargetAtTime(z, now, 0.04);
    } else panner.setPosition(x, y, z);
  }

  sound({ frequency = 300, endFrequency, type = 'sine', duration = 0.15, volume = 0.1, delay = 0, position, noise = false, filter = 1300, music = false }) {
    if (!this.context || this.context.state !== 'running' || this.voices.size > 96) return;
    const ctx = this.context;
    const when = ctx.currentTime + delay;
    const source = noise ? ctx.createBufferSource() : ctx.createOscillator();
    if (noise) {
      source.buffer = this.noiseBuffer;
      source.playbackRate.value = clamp(frequency / 300, 0.1, 4);
    } else {
      source.type = type;
      source.frequency.setValueAtTime(Math.max(1, frequency), when);
      if (endFrequency) source.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), when + duration);
    }
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), when + Math.min(0.009, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    const nodes = [source, envelope];
    let tail = source;
    if (noise) {
      const toneFilter = ctx.createBiquadFilter();
      toneFilter.type = 'lowpass';
      toneFilter.frequency.value = filter;
      source.connect(toneFilter);
      tail = toneFilter;
      nodes.push(toneFilter);
    }
    tail.connect(envelope);
    if (position) {
      const panner = this.makePanner(position);
      nodes.push(panner);
      envelope.connect(panner).connect(music ? this.musicGain : this.effectsGain);
    } else envelope.connect(music ? this.musicGain : this.effectsGain);
    this.voices.add(source);
    source.onended = () => { for (const node of nodes) node.disconnect(); this.voices.delete(source); };
    source.start(when);
    source.stop(when + duration + 0.03);
  }

  play(name, position = null) {
    if (!this.context) return;
    const tone = options => this.sound({ position, ...options });
    const noise = options => tone({ noise: true, ...options });
    switch (name) {
      case 'hunt-hit':
        noise({frequency:240,filter:650,duration:.1,volume:.12});break;
      case 'eat':
        [0,.12,.25].forEach(delay=>noise({frequency:440,filter:1400,duration:.09,volume:.09,delay}));break;
      case 'step': case 'grass': case 'step-grass': case 'footstep_grass':
        noise({ frequency: 330, filter: 1150, duration: 0.13, volume: 0.12 }); break;
      case 'stone': case 'step-stone': case 'footstep_stone':
        tone({ frequency: 105, endFrequency: 58, duration: 0.065, volume: 0.13 });
        noise({ frequency: 800, filter: 2100, duration: 0.055, volume: 0.09 }); break;
      case 'wood': case 'step-wood': case 'footstep_wood':
        tone({ frequency: 185, endFrequency: 92, type: 'triangle', duration: 0.09, volume: 0.13 }); break;
      case 'sand': case 'step-sand': case 'footstep_sand':
        noise({ frequency: 440, filter: 2200, duration: 0.19, volume: 0.15 }); break;
      case 'water': case 'splash':
        noise({ frequency: 380, filter: 2200, duration: 0.4, volume: 0.22 });
        tone({ frequency: 400, endFrequency: 90, duration: 0.16, volume: 0.055 }); break;
      case 'mine': case 'mining': case 'break': case 'block-break':
        noise({ frequency: 580, filter: 1500, duration: 0.17, volume: 0.26 });
        tone({ frequency: 95, endFrequency: 45, duration: 0.12, volume: 0.15 }); break;
      case 'place': case 'block-place':
        tone({ frequency: 180, endFrequency: 72, type: 'triangle', duration: 0.11, volume: 0.18 });
        noise({ frequency: 500, filter: 850, duration: 0.055, volume: 0.1 }); break;
      case 'pickup': case 'collect':
        tone({ frequency: 650, endFrequency: 1100, duration: 0.1, volume: 0.075 }); break;
      case 'inventory': case 'click':
        tone({ frequency: 420, endFrequency: 330, duration: 0.07, volume: 0.05 }); break;
      case 'craft':
        [60, 64, 67, 72].forEach((note, i) => tone({ frequency: midi(note), duration: 0.26, delay: i * 0.08, volume: 0.085 })); break;
      case 'door': case 'chest':
        tone({ frequency: 135, endFrequency: 58, type: 'triangle', duration: 0.24, volume: 0.14 });
        noise({ frequency: 180, filter: 420, duration: 0.25, volume: 0.13 }); break;
      case 'bark': case 'dog':
        [0, 0.19].forEach(delay => {
          tone({ frequency: 190, endFrequency: 78, type: 'sawtooth', duration: 0.12, delay, volume: 0.06 });
          noise({ frequency: 210, filter: 720, duration: 0.1, delay, volume: 0.15 });
        }); break;
      case 'meow': case 'cat':
        tone({ frequency: 550, endFrequency: 760, type: 'triangle', duration: 0.17, volume: 0.09 });
        tone({ frequency: 760, endFrequency: 380, type: 'triangle', duration: 0.45, delay: 0.14, volume: 0.085 }); break;
      case 'purr': case 'pet':
        for (let i = 0; i < 7; i++) tone({ frequency: 45 + i % 2 * 10, type: 'triangle', duration: 0.11, delay: i * 0.09, volume: 0.095 });
        break;
      case 'horn':
        [349.2, 440].forEach(frequency => tone({ frequency, type: 'triangle', duration: 0.45, volume: 0.15 })); break;
      case 'whistle':
        tone({frequency:1250,endFrequency:2100,type:'sine',duration:.22,volume:.11});
        tone({frequency:1850,endFrequency:1450,type:'sine',duration:.32,delay:.25,volume:.1});break;
      case 'brake':
        noise({ frequency: 740, filter: 2600, duration: 0.3, volume: 0.16 }); break;
      case 'collision': case 'bump': case 'hurt':
        noise({ frequency: 270, filter: 900, duration: 0.26, volume: 0.3 });
        tone({ frequency: 72, endFrequency: 30, duration: 0.2, volume: 0.23 }); break;
      case 'enter': case 'exit': case 'car-enter':
        noise({ frequency: 280, filter: 600, duration: 0.12, volume: 0.16 });
        tone({ frequency: 110, endFrequency: 55, duration: 0.12, volume: 0.13 }); break;
      case 'bird':
        [0, 0.16, 0.38].forEach((delay, i) => tone({ frequency: 1700 + i * 270, endFrequency: 2600 - i * 220, duration: 0.12, delay, volume: 0.04 })); break;
      case 'night':
        for (let i = 0; i < 4; i++) tone({ frequency: 2600 + i * 55, duration: 0.035, delay: i * 0.09, volume: 0.017 });
        break;
      default: break;
    }
  }

  engine(speed = 0, position = null) {
    if (!this.context) return;
    this.engineSpeed = Math.abs(Number(speed) || 0);
    this.lastEngineTime = this.elapsed;
    const amount = clamp(this.engineSpeed / 18);
    const now = this.context.currentTime;
    this.engineOsc.frequency.setTargetAtTime(38 + amount * 125, now, 0.13);
    this.engineFilter.frequency.setTargetAtTime(150 + amount * 650, now, 0.1);
    this.engineGain.gain.setTargetAtTime(this.engineSpeed > 0 ? 0.025 + amount * 0.065 : 0, now, 0.15);
    if (position) this.movePanner(this.enginePanner, position);
  }

  stopEngine() { this.engine(0); }

  piano(note, delay = 0, volume = 0.075) {
    const frequency = midi(note);
    this.sound({ frequency, duration: 2.5, volume, delay, music: true });
    this.sound({ frequency: frequency * 2.001, duration: 0.8, volume: volume * 0.28, delay, music: true });
    this.sound({ frequency: frequency * 3, duration: 0.22, volume: volume * 0.09, delay, music: true });
  }

  update(dt, { position, forward, time = 0.3, moving = false, material = 1, inWater = false, panting = 0 } = {}) {
    if (!this.context || this.paused || this.context.state !== 'running') return;
    dt = clamp(dt, 0, 0.25);
    this.elapsed += dt;
    this.breathTime-=dt;
    if(panting>.1&&!inWater&&this.breathTime<=0){
      const effort=clamp(panting);
      this.sound({noise:true,frequency:170,filter:780,duration:.22,volume:.07+effort*.11});
      this.sound({noise:true,frequency:210,filter:1100,duration:.3,volume:.08+effort*.13,delay:.28});
      this.breathTime=1.55-effort*.65;
    }
    const now = this.context.currentTime;
    if (position) {
      const listener = this.context.listener;
      const [x, y, z] = point(position);
      const [fx, fy, fz] = forward ? point(forward) : [0, 0, -1];
      if (listener.positionX) {
        [listener.positionX, listener.positionY, listener.positionZ, listener.forwardX, listener.forwardY, listener.forwardZ, listener.upX, listener.upY, listener.upZ]
          .forEach((param, i) => param.setTargetAtTime([x, y, z, fx, fy, fz, 0, 1, 0][i], now, 0.03));
      } else { listener.setPosition(x, y, z); listener.setOrientation(fx, fy, fz, 0, 1, 0); }
      this.movePanner(this.waterPanner, [x + 1.5, y - 1, z]);
    }
    this.waterGain.gain.setTargetAtTime(inWater ? 0.16 : 0, now, 0.3);
    this.windGain.gain.setTargetAtTime(0.02 + Math.sin(this.elapsed * 0.16) * 0.006, now, 0.4);
    if (this.engineSpeed > 0 && this.elapsed - this.lastEngineTime > 0.5) this.stopEngine();
    if (moving) {
      this.stepTime -= dt;
      if (this.stepTime <= 0) {
        const kind = inWater ? 'splash' : material === 4 || material === 'sand' ? 'step-sand' : [5, 12, 15, 16, 'wood'].includes(material) ? 'step-wood' : [3, 8, 10, 11, 17, 'stone'].includes(material) ? 'step-stone' : 'step-grass';
        this.play(kind);
        this.stepTime = inWater ? 0.6 : 0.38;
      }
    } else this.stepTime = 0.08;
    this.ambientTime -= dt;
    if (this.ambientTime <= 0) {
      const [x, y, z] = point(position);
      const phase = ((time % 1) + 1) % 1;
      this.play(phase > 0.19 && phase < 0.8 ? 'bird' : 'night', [x + Math.cos(this.elapsed) * 9, y + 4, z + Math.sin(this.elapsed) * 9]);
      this.ambientTime = 8 + Math.random() * 13;
    }
    this.musicTime -= dt;
    if (this.musicTime <= 0) {
      // Original six-bar motif. A long silent interval leaves room for the world.
      const melody = [64, 67, 71, 67, 62, 69, 72, 69, 64, 67, 74, 71, 60, 64, 69, 67, 62, 65, 69, 74, 64, 67, 71, 60];
      const bass = [48, 45, 52, 48, 50, 48];
      this.piano(melody[this.musicNote], 0, 0.074);
      if (this.musicNote % 4 === 0) this.piano(bass[Math.floor(this.musicNote / 4)], 0.02, 0.053);
      this.musicNote++;
      if (this.musicNote === melody.length) { this.musicNote = 0; this.musicPhrase++; this.musicTime = 48 + (this.musicPhrase % 3) * 9; }
      else this.musicTime = this.musicNote % 4 === 0 ? 2.4 : 1.2;
    }
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (!this.context) return;
    const now = this.context.currentTime;
    // Simulation stops in menus, while explicit UI feedback (crafting/petting)
    // remains audible. Pause only continuous world sources and the piano bus.
    this.musicGain.gain.setTargetAtTime(this.paused ? 0 : this.musicVolume, now, 0.04);
    this.windGain.gain.setTargetAtTime(this.paused ? 0 : 0.02, now, 0.04);
    if (this.paused) {
      this.waterGain.gain.setTargetAtTime(0, now, 0.04);
      this.engineGain.gain.setTargetAtTime(0, now, 0.04);
    }
    if (!this.paused && this.context.state === 'suspended') this.context.resume().catch(() => {});
  }

  dispose() {
    if (!this.context) return;
    for (const source of this.voices) { try { source.stop(); } catch { /* Already ended. */ } }
    for (const source of [this.windSource, this.waterSource, this.engineOsc]) { try { source?.stop(); source?.disconnect(); } catch { /* Already closed. */ } }
    this.context.close().catch(() => {});
    this.voices.clear();
    this.context = null;
  }
}
