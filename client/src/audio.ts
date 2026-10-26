import { useStore } from './store';

let ctx: AudioContext | null = null;
const sfxVol = () => { const s = useStore.getState().settings; return s.sound ? s.soundVol : 0; };
function tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.05, delay = 0) {
  gain *= sfxVol();
  if (gain <= 0) return;
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
  gain *= sfxVol();
  if (gain <= 0) return true;
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

/** A short buzz on the phone (when vibration is on and the device can). */
export function vibrate(pattern: number | number[]) {
  if (!useStore.getState().settings.vibration) return;
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

export const sfx = {
  click: () => sample('click', 0.5) || tone(900, 0.03, 'square', 0.02),
  select: () => sample('select', 0.6) || tone(660, 0.07, 'sine', 0.04),
  place: () => { vibrate(18); return sample('place') || tone(220, 0.1, 'triangle', 0.07); },
  coin: () => sample('coin', 0.7) || (tone(880, 0.08, 'square', 0.03), tone(1320, 0.1, 'square', 0.03, 0.07)),
  advance: () => sample('coin', 0.6) || (tone(330, 0.1, 'sawtooth', 0.03), tone(495, 0.14, 'sawtooth', 0.03, 0.08)),
  bad: () => { vibrate([30, 40, 30]); return sample('bad', 0.7) || tone(120, 0.18, 'square', 0.04); },
  turn: () => sample('turn', 0.6) || tone(660, 0.07, 'sine', 0.04),
  tick: () => sample('tick', 0.25) || tone(1250, 0.025, 'square', 0.015),
  bonus: () => sample('bonus') || [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.05, i * 0.08)),
  achievement: () => sample('achievement') || [659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.05, i * 0.09)),
  levelUp: () => sample('levelUp') || [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'triangle', 0.05, i * 0.09)),
  warn: () => sample('warn', 0.7) || tone(300, 0.2, 'triangle', 0.04),
  win: () => { vibrate([40, 60, 80]); return sample('win') || [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, i * 0.12)); },
  lose: () => sample('lose') || [330, 262, 196].forEach((f, i) => tone(f, 0.28, 'sine', 0.05, i * 0.14)),
};

/** Every button press clicks; the samples load on the first tap. */
export function installUiSounds() {
  document.addEventListener('pointerdown', (e) => {
    void loadSounds();
    startMusic();
    const el = (e.target as Element | null)?.closest('button');
    if (el && !(el as HTMLButtonElement).disabled && !el.closest('.gcard, .pb, .medal')) sfx.click(); // game actions have their own sounds
  }, { capture: true });
}

/**
 * Background music: a quiet santur-like line in the Persian Shur mode, made on the fly (no file to download), played
 * on the menus and dimmed during a game. Its volume is the Music slider.
 */
const SHUR = [293.66, 311.13, 349.23, 392.0, 440.0, 466.16, 523.25, 587.33]; // D Eb F G A Bb C D
let musicTimer: number | null = null;
let musicBus: GainNode | null = null;
let step = 0;
function pluck(ac: AudioContext, freq: number, t: number, gain: number) {
  const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = freq;
  o2.type = 'sine'; o2.frequency.value = freq * 2.01; // a little shimmer, like the paired strings of a santur
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(g); o2.connect(g); g.connect(musicBus!);
  o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
}
function musicTick() {
  if (!ctx || !musicBus) return;
  const s = useStore.getState();
  const vol = s.settings.sound ? s.settings.musicVol * (s.screen === 'game' ? 0.45 : 1) : 0;
  musicBus.gain.setTargetAtTime(vol * 0.5, ctx.currentTime, 0.3);
  if (vol > 0) {
    // a slow walk around the mode, resting on D and G, with an octave drone every bar
    const phrase = [0, 2, 3, 2, 1, 0, 3, 4, 5, 4, 3, 2, 3, 1, 0, 0];
    const deg = phrase[step % phrase.length];
    const t = ctx.currentTime + 0.05;
    pluck(ctx, SHUR[deg], t, 0.09);
    if (step % 4 === 0) pluck(ctx, SHUR[0] / 2, t, 0.06);
    if (step % 8 === 6) pluck(ctx, SHUR[deg + 2] ?? SHUR[7], t + 0.18, 0.05);
  }
  step++;
}
/** Start the music loop (after the first tap, when audio is allowed). */
export function startMusic() {
  if (musicTimer !== null) return;
  try {
    ctx = ctx ?? new AudioContext();
    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    // a soft echo makes the plucks ring like in a tiled hall
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.32; fb.gain.value = 0.32; wet.gain.value = 0.35;
    musicBus.connect(ctx.destination); musicBus.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(ctx.destination);
    musicTimer = window.setInterval(musicTick, 460);
  } catch { /* audio unavailable */ }
}
