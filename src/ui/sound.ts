/**
 * Small sound effects made on the fly with the Web Audio API (no sound files),
 * plus phone vibration. Both follow the settings and stay quiet until the
 * person has touched the page (browsers block audio before that).
 */
import { getSettings } from '../theme/settings';

export type SoundName = 'move' | 'turn' | 'win' | 'lose' | 'draw' | 'chat' | 'tick' | 'achievement' | 'hit' | 'error';

let ctx: AudioContext | null = null;
let unlocked = false;

function audio(): AudioContext | null {
  if (!unlocked) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call once at start-up: sounds become possible after the first tap or key press */
export function initSound() {
  const unlock = () => {
    unlocked = true;
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** One note: frequency (Hz), start offset and length (s), waveform, relative loudness */
type Note = [number, number, number, OscillatorType?, number?];

const SOUNDS: Record<SoundName, Note[]> = {
  move: [[520, 0, 0.06, 'triangle', 0.5]],
  turn: [
    [660, 0, 0.09, 'sine'],
    [880, 0.1, 0.14, 'sine'],
  ],
  win: [
    [523, 0, 0.12, 'triangle'],
    [659, 0.12, 0.12, 'triangle'],
    [784, 0.24, 0.12, 'triangle'],
    [1047, 0.36, 0.3, 'triangle'],
  ],
  lose: [
    [392, 0, 0.18, 'sine'],
    [330, 0.18, 0.18, 'sine'],
    [262, 0.36, 0.35, 'sine'],
  ],
  draw: [
    [440, 0, 0.15, 'sine'],
    [440, 0.2, 0.15, 'sine'],
  ],
  chat: [[990, 0, 0.07, 'sine', 0.5]],
  tick: [[1200, 0, 0.03, 'square', 0.25]],
  achievement: [
    [784, 0, 0.1, 'triangle'],
    [988, 0.1, 0.1, 'triangle'],
    [1319, 0.2, 0.3, 'triangle'],
  ],
  hit: [[300, 0, 0.05, 'square', 0.35]],
  error: [[180, 0, 0.15, 'sawtooth', 0.3]],
};

export function playSound(name: SoundName) {
  const s = getSettings();
  if (!s.sound || s.volume <= 0) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.01;
  const master = ac.createGain();
  master.gain.value = Math.min(1, s.volume) * 0.25;
  master.connect(ac.destination);
  for (const [freq, at, len, type = 'sine', loud = 1] of SOUNDS[name]) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    // Short fade in and out so notes don't click
    g.gain.setValueAtTime(0, t0 + at);
    g.gain.linearRampToValueAtTime(loud, t0 + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + at + len);
    osc.connect(g).connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + len + 0.05);
  }
}

const PATTERNS: Partial<Record<SoundName, number | number[]>> = {
  turn: 60,
  win: [80, 60, 80, 60, 160],
  lose: 250,
  achievement: [50, 40, 50],
  hit: 20,
  error: 120,
};

export function vibrate(name: SoundName) {
  if (!getSettings().vibrate || !unlocked) return;
  const p = PATTERNS[name];
  if (p === undefined) return;
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not supported */
  }
}

/** Sound and vibration together */
export function feedback(name: SoundName) {
  playSound(name);
  vibrate(name);
}
