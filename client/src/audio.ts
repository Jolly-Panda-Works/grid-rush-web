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
export const sfx = {
  place: () => tone(220, 0.1, 'triangle', 0.07),
  coin: () => { tone(880, 0.08, 'square', 0.03); tone(1320, 0.1, 'square', 0.03, 0.07); },
  advance: () => { tone(330, 0.1, 'sawtooth', 0.03); tone(495, 0.14, 'sawtooth', 0.03, 0.08); },
  bad: () => tone(120, 0.18, 'square', 0.04),
  turn: () => tone(660, 0.07, 'sine', 0.04),
  tick: () => tone(1250, 0.025, 'square', 0.015),
  bonus: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.05, i * 0.08)),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.06, i * 0.12)),
  lose: () => [330, 262, 196].forEach((f, i) => tone(f, 0.28, 'sine', 0.05, i * 0.14)),
};
