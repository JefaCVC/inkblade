// INKBLADE sound: every sound is synthesised with Web Audio at run time —
// no audio files, no network. Brush swishes are filtered noise sweeps, each
// element has its own impact voice, and a slow pentatonic pluck drifts under
// the game like a koto in the next room. M or the mute button silences it all.

let ctx = null;
let muted = false;
let musicTimer = null;
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

function ensure() {
  if (ctx === null) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() { ensure(); }
export function setMuted(value) { muted = value; }
export function isMuted() { return muted; }

function tone({ freq, freqEnd = null, type = 'sine', dur = 0.2, gain = 0.15, when = 0 }) {
  const ac = ensure();
  if (!ac || muted) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.25, gain = 0.2, filterFreq = 1200, type = 'lowpass', sweepTo = null, when = 0 }) {
  const ac = ensure();
  if (!ac || muted) return;
  const t0 = ac.currentTime + when;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(filterFreq, t0);
  if (sweepTo !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 10), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
}

export function playBrushSwish() {
  noise({ dur: 0.18, gain: 0.08, filterFreq: 900, type: 'bandpass', sweepTo: 2600 });
}

export function playClick() { tone({ freq: 660, dur: 0.07, gain: 0.08, type: 'triangle' }); }

export function playSealStamp() {
  tone({ freq: 140, freqEnd: 60, dur: 0.25, gain: 0.25, type: 'sine' });
  noise({ dur: 0.12, gain: 0.15, filterFreq: 500 });
}

export function playBossRoar() {
  tone({ freq: 90, freqEnd: 55, dur: 0.7, gain: 0.22, type: 'sawtooth' });
  tone({ freq: 135, freqEnd: 70, dur: 0.6, gain: 0.12, type: 'square', when: 0.05 });
}

export function playHurt() {
  tone({ freq: 220, freqEnd: 110, dur: 0.18, gain: 0.2, type: 'square' });
}

export function playFizzle() {
  tone({ freq: 300, freqEnd: 180, dur: 0.22, gain: 0.1, type: 'triangle' });
}

export function playPerfect() {
  tone({ freq: 880, dur: 0.12, gain: 0.12, type: 'sine' });
  tone({ freq: 1318, dur: 0.2, gain: 0.1, type: 'sine', when: 0.08 });
}

// One impact voice per element, so fire sounds nothing like ice.
export function playElementImpact(elementId) {
  switch (elementId) {
    case 'fire':
      noise({ dur: 0.35, gain: 0.22, filterFreq: 800, sweepTo: 200 });
      tone({ freq: 180, freqEnd: 60, dur: 0.3, gain: 0.15, type: 'sawtooth' });
      break;
    case 'water':
      tone({ freq: 700, freqEnd: 180, dur: 0.35, gain: 0.16, type: 'sine' });
      noise({ dur: 0.3, gain: 0.12, filterFreq: 1800, type: 'bandpass', sweepTo: 400 });
      break;
    case 'lightning':
      for (let i = 0; i < 5; i += 1) {
        tone({ freq: 1400 + Math.random() * 900, dur: 0.05, gain: 0.1, type: 'square', when: i * 0.04 });
      }
      noise({ dur: 0.2, gain: 0.18, filterFreq: 4000, type: 'highpass' });
      break;
    case 'wind':
      noise({ dur: 0.4, gain: 0.16, filterFreq: 600, type: 'bandpass', sweepTo: 2400 });
      break;
    case 'earth':
      tone({ freq: 90, freqEnd: 40, dur: 0.4, gain: 0.28, type: 'sine' });
      noise({ dur: 0.15, gain: 0.12, filterFreq: 300 });
      break;
    case 'ice':
      tone({ freq: 1568, dur: 0.25, gain: 0.1, type: 'sine' });
      tone({ freq: 2093, dur: 0.3, gain: 0.08, type: 'sine', when: 0.06 });
      noise({ dur: 0.2, gain: 0.08, filterFreq: 5000, type: 'highpass' });
      break;
    case 'light':
      [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.4, gain: 0.09, type: 'sine', when: i * 0.05 }));
      break;
    case 'dark':
      tone({ freq: 110, freqEnd: 55, dur: 0.5, gain: 0.2, type: 'sawtooth' });
      tone({ freq: 165, freqEnd: 82, dur: 0.45, gain: 0.1, type: 'triangle', when: 0.05 });
      break;
    default:
      tone({ freq: 440, dur: 0.15, gain: 0.12 });
  }
}

export function playVictory() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, dur: 0.35, gain: 0.11, type: 'triangle', when: i * 0.12 }));
}

// A fusion combo: two elements collapse into one — a rising arpeggio over a
// low swell, distinct from any single element's voice.
export function playCombo() {
  tone({ freq: 110, freqEnd: 220, dur: 0.6, gain: 0.16, type: 'sawtooth' });
  [392, 523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.3, gain: 0.1, type: 'triangle', when: i * 0.06 }));
  noise({ dur: 0.4, gain: 0.1, filterFreq: 2000, type: 'bandpass', sweepTo: 400 });
}

export function playRankUp() {
  [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.4, gain: 0.12, type: 'triangle', when: i * 0.1 }));
  tone({ freq: 1568, dur: 0.6, gain: 0.1, type: 'sine', when: 0.4 });
}

export function playDefeat() {
  [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.4, gain: 0.11, type: 'triangle', when: i * 0.16 }));
}

// A sparse pentatonic pluck, one note every few seconds, koto-like.
export function startMusic() {
  if (musicTimer !== null) return;
  const pluck = () => {
    if (!muted) {
      const f = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
      tone({ freq: f, dur: 1.4, gain: 0.045, type: 'triangle' });
      tone({ freq: f * 2, dur: 0.7, gain: 0.015, type: 'sine' });
    }
    musicTimer = setTimeout(pluck, 2600 + Math.random() * 2600);
  };
  musicTimer = setTimeout(pluck, 1200);
}

export function stopMusic() {
  if (musicTimer !== null) { clearTimeout(musicTimer); musicTimer = null; }
}
