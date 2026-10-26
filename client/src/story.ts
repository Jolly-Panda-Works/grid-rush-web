import { LAST_LEVEL, STORY, levelById } from '../../shared/src';
import type { SoloAction, StepsProgress, ToolCounts } from '../../shared/src';
import { api } from './account';
import { useStore } from './store';

/**
 * Story mode on the device (docs/story-mode.md). The server owns bricks, coins, lives and tools; this module keeps
 * a copy of its view for the screens, starts and finishes levels through its API, and queues the results of the
 * tutorial levels (1-10, which need no lives or coins) when the server cannot be reached.
 */
export interface StoryView {
  level: number; bricks: number; steps: StepsProgress; unlocked: boolean;
  coins: number; lives: number; livesIn: number; tools: ToolCounts;
  results: Record<number, { stars: number; score: number }>;
  /** results waiting to be sent (offline): shown as "pending" */
  pending?: number;
}
export interface LevelResult { won: boolean; stars: number; score: number; coins: number; bricks: number; unlockedNow: boolean; offline?: boolean }

// (function declarations only up to loadStory: the store calls it while the modules are still loading)
const CACHE = 'gridrush.story.v1';
const QUEUE = 'gridrush.storyQueue.v1';
interface Queued { level: number; actions: SoloAction[] }

function read<T>(k: string, d: T): T { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } }
function write(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

export function defaultStory(unlocked: boolean): StoryView {
  return { level: 1, bricks: 0, steps: {}, unlocked, coins: 0, lives: 5, livesIn: 0, tools: {}, results: {} };
}
/** The last known story state (players who already played PvP start unlocked). */
export function loadStory(xp: number): StoryView {
  const v = read<StoryView | null>('gridrush.story.v1', null);
  return v && typeof v.level === 'number' ? { ...defaultStory(xp > 0), ...v } : defaultStory(xp > 0);
}
function setStory(v: StoryView) {
  const pending = read<Queued[]>(QUEUE, []).length;
  const next = { ...v, pending };
  write(CACHE, next);
  useStore.setState({ story: next, storyAt: Date.now() });
}

/** Fetch the server's state, after sending what waited in the queue. */
export async function refreshStory(): Promise<boolean> {
  await flushQueue();
  const r = await api<StoryView>('/story');
  if (!r?.ok) return false;
  setStory(r.data);
  return true;
}

async function flushQueue() {
  const q = read<Queued[]>(QUEUE, []);
  while (q.length) {
    const r = await api<{ story: StoryView }>('/story/level/finish', { method: 'POST', body: q[0] });
    if (!r) break; // still offline
    q.shift(); // sent (or refused for good, e.g. replayed elsewhere already)
    write(QUEUE, q);
    if (r.ok) setStory(r.data.story);
  }
}

/** What the current level needs from the server: an attempt (lives, tools, coin bag) after the tutorial. */
export interface Attempt { attemptId: string | null; tools: ToolCounts; coinBag: boolean }
export type StartError = 'offline' | 'no_lives' | 'coins' | 'locked' | 'error';

export async function startAttempt(level: number, coinBag: boolean): Promise<Attempt | StartError> {
  if (level <= STORY.TUTORIAL_LEVELS) return { attemptId: null, tools: {}, coinBag: false };
  const r = await api<{ attemptId: string; tools: ToolCounts; coinBag: boolean; story: StoryView; error?: string }>('/story/level/start', { method: 'POST', body: { level, coinBag } });
  if (!r) return 'offline';
  if (!r.ok) return (r.data.error as StartError) ?? 'error';
  setStory(r.data.story);
  return { attemptId: r.data.attemptId, tools: r.data.tools, coinBag: r.data.coinBag };
}

/** Pays for a classic continue (free in the tutorial levels). */
export async function payContinue(attemptId: string | null): Promise<true | 'offline' | 'coins' | 'error'> {
  if (!attemptId) return true;
  const r = await api<{ story: StoryView; error?: string }>('/story/continue', { method: 'POST', body: { attemptId } });
  if (!r) return 'offline';
  if (!r.ok) return r.data.error === 'coins' ? 'coins' : 'error';
  setStory(r.data.story);
  return true;
}

/** The end of a level (won, lost, or left). Offline tutorial results are queued and shown as pending. */
export async function finishAttempt(level: number, attempt: Attempt, actions: SoloAction[], local: { won: boolean; stars: number; score: number; coins: number }): Promise<LevelResult> {
  const body = attempt.attemptId ? { attemptId: attempt.attemptId, actions } : { level, actions };
  const r = await api<LevelResult & { story: StoryView }>('/story/level/finish', { method: 'POST', body });
  if (r?.ok) { setStory(r.data.story); return r.data; }
  if (r || attempt.attemptId || !actions.length) return { ...local, coins: 0, bricks: 0, unlockedNow: false, offline: !r };
  // offline tutorial level: queue it, move on locally
  const q = read<Queued[]>(QUEUE, []);
  q.push({ level, actions });
  write(QUEUE, q);
  const st = useStore.getState().story;
  const first = local.won && level === st.level;
  const best = st.results[level]?.stars ?? 0;
  setStory({
    ...st,
    level: first ? Math.min(LAST_LEVEL + 1, st.level + 1) : st.level,
    bricks: st.bricks + (first ? 1 : 0),
    unlocked: st.unlocked || (first && level === STORY.TUTORIAL_LEVELS),
    results: local.won ? { ...st.results, [level]: { stars: Math.max(best, local.stars), score: Math.max(st.results[level]?.score ?? 0, local.score) } } : st.results,
  });
  return { ...local, bricks: first ? 1 : 0, unlockedNow: first && level === STORY.TUTORIAL_LEVELS, offline: true };
}

/** A restoration step (bricks), or a new design for a step that is done. */
export async function buyStep(space: string, step: number, choice?: number): Promise<true | 'offline' | string> {
  const r = await api<StoryView & { error?: string }>('/story/step', { method: 'POST', body: { space, step, choice } });
  if (!r) return 'offline';
  if (!r.ok) return r.data.error ?? 'error';
  setStory(r.data);
  return true;
}

export async function shop(item: string): Promise<true | 'offline' | 'coins'> {
  const r = await api<StoryView>('/story/shop', { method: 'POST', body: { item } });
  if (!r) return 'offline';
  if (!r.ok) return 'coins';
  setStory(r.data);
  return true;
}

/** Lives as of now (the server's count plus what the clock refilled since it answered). */
export function livesNow(v: StoryView, at: number): { lives: number; nextIn: number } {
  let lives = v.lives, next = v.livesIn - (Date.now() - at);
  while (lives < STORY.LIVES_MAX && v.livesIn > 0 && next <= 0) { lives++; next += STORY.LIFE_MS; }
  return { lives, nextIn: lives >= STORY.LIVES_MAX ? 0 : Math.max(0, next) };
}

export const levelExists = (id: number) => !!levelById(id);
