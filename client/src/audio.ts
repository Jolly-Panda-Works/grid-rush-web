import { useStore } from './store';

let ctx: AudioContext | null = null;
function tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.05, delay = 0) {
  if (!useStore.getState().settings.sound) return;
  try {
    ctx = ctx ?? new AudioContext();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
  } catch { /* audio unavailable */ }
}
/**
 * Sound effects: recorded samples from the UI sound library (public/sfx, see tools/convert-sfx.py), each with the
 * old synthesized tone as a fallback while a sample is missing or still loading.
 */
const SAMPLES = {
  click: 'click', select: 'select', place: 'place', coin: 'coin', bad: 'error', turn: 'turn', bonus: 'reward',
  achievement: 'achievement', win: 'win', lose: 'lose', levelUp: 'level-up', warn: 'warning', tick: 'click',
} as const;
type Sample = keyof typeof SAMPLES;
const buffers = new Map<string, AudioBuffer | null>(); // null = missing (use the tone)
let loading: Promise<void> | null = null;
/** Fetch and decode every sample once (called on the first tap: browsers only start audio after a gesture). */
export function loadSounds(): Promise<void> {
  if (loading) return loading;
  try { ctx = ctx ?? new AudioContext(); } catch { return Promise.resolve(); }
  const ac = ctx;
  loading = Promise.all([...new Set(Object.values(SAMPLES))].map(async (name) => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}sfx/${name}.wav`);
      buffers.set(name, r.ok ? await ac.decodeAudioData(await r.arrayBuffer()) : null);
    } catch { buffers.set(name, null); }
  })).then(() => undefined);
  return loading;
}
/** Play a sample; false when it is not available (the caller then plays the tone). */
function sample(id: Sample, gain = 0.8): boolean {
  if (!useStore.getState().settings.sound) return true;
  const buf = buffers.get(SAMPLES[id]);
  if (!buf || !ctx) return false;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = gain;
    src.connect(g).connect(ctx.destination); src.start();
    return true;
  } catch { return false; }
}

export const sfx = {
  click: () => sample('click', 0.5) || tone(900, 0.03, 'square', 0.02),
  select: () => sample('select', 0.6) || tone(660, 0.07, 'sine', 0.04),
  place: () => sample('place') || tone(220, 0.1, 'triangle', 0.07),
  coin: () => sample('coin', 0.7) || (tone(880, 0.08, 'square', 0.03), tone(1320, 0.1, 'square', 0.03, 0.07)),
  advance: () => sample('coin', 0.6) || (tone(330, 0.1, 'sawtooth', 0.03), tone(495, 0.14, 'sawtooth', 0.03, 0.08)),
  bad: () => sample('bad', 0.7) || tone(120, 0.18, 'square', 0.04),
  turn: () => sample('turn', 0.6) || tone(660, 0.07, 'sine', 0.04),
  tick: () => sample('tick', 0.25) || tone(1250, 0.025, 'square', 0.015),
  bonus: () => sample('bonus') || [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.05, i * 0.08)),
  achievement: () => sample('achievement') || [659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.05, i * 0.09)),
  levelUp: () => sample('levelUp') || [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.05, i * 0.09)),
  warn: () => sample('warn', 0.7) || tone(300, 0.2, 'triangle', 0.04),
  win: () => sample('win') || [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, i * 0.12)),
  lose: () => sample('lose') || [330, 262, 196].forEach((f, i) => tone(f, 0.28, 'sine', 0.05, i * 0.14)),
};

/** Every button press clicks; the samples load on the first tap. */
export function installUiSounds() {
  document.addEventListener('pointerdown', (e) => {
    void loadSounds();
    const el = (e.target as Element | null)?.closest('button');
    if (el && !(el as HTMLButtonElement).disabled && !el.closest('.gcard, .pb, .medal')) sfx.click(); // game actions have their own sounds
  }, { capture: true });
}
