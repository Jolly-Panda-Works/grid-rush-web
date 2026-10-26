import { STORY, levelById, soloScore, starsOf, winCoins } from '../../shared/src';
import { sfx } from './audio';
import { tr } from './i18n';
import { addToCollection } from './museum';
import { backToMap, levelActions, send, startLevelGame } from './net';
import { DialogLine, needServer, pushToast, showDialog, useStore } from './store';
import { finishAttempt, payContinue, startAttempt } from './story';

/**
 * How a story level is opened, played to its end and left: the level-start card, the intro dialog, the attempt on
 * the server, the result, a continue, a retry. The screens call these; the rules live in shared/src/story.
 */

const M = (key: string, mood: DialogLine['mood'] = 'normal'): DialogLine => ({ who: 'master', key, mood });
const G = (key: string, mood: DialogLine['mood'] = 'normal'): DialogLine => ({ who: 'grandchild', key, mood });

/** Dialog before a level (the first time it is played). */
const INTRO: Record<number, DialogLine[]> = {
  1: [G('story.l1.a', 'happy'), M('story.l1.b')],
  2: [M('story.l2.a')],
  3: [M('story.l3.a')],
  4: [M('story.l4.a')],
  5: [G('story.l5.a', 'surprised'), M('story.l5.b')],
  6: [M('story.l6.a')],
  7: [M('story.l7.a')],
  8: [M('story.l8.a', 'happy')],
  9: [M('story.l9.a')],
  10: [M('story.l10.a')],
  11: [M('story.l11.a'), G('story.l11.b')],
  12: [M('story.l12.a')],
  13: [M('story.l13.a', 'happy')],
  14: [G('story.l14.a', 'surprised'), M('story.l14.b')],
  29: [M('story.l29.a')],
  30: [M('story.l30.a', 'happy')],
};
/** The scene after level 10: the tutorial is over, the battles and the museum open. */
const UNLOCK: DialogLine[] = [M('story.unlock.a', 'happy'), M('story.unlock.b'), G('story.unlock.c', 'happy')];

const TOUR_KEY = 'gridrush.unlockTour.v1';

/** The level-start card. */
export function openLevel(id: number) {
  if (!levelById(id)) return;
  sfx.select();
  useStore.setState({ levelPrep: id });
}

/** Start: an attempt on the server after the tutorial (a life, the coin bag), the intro the first time, then the board. */
export async function beginLevel(id: number, coinBag: boolean): Promise<'ok' | 'no_lives' | 'coins' | 'offline' | 'error' | 'locked'> {
  const def = levelById(id);
  if (!def) return 'error';
  if (id > STORY.TUTORIAL_LEVELS && !needServer('off.what.level')) return 'offline';
  const a = await startAttempt(id, coinBag);
  if (typeof a === 'string') return a;
  useStore.setState({ levelPrep: null });
  const st = useStore.getState().story;
  const first = !st.results[id];
  showDialog(first ? INTRO[id] ?? [] : [], () => startLevelGame(def, a));
  return 'ok';
}

/** The level ended with a win: send it, show the result. */
export async function settleWin() {
  const st = useStore.getState();
  const lp = st.levelPlay, g = st.game;
  if (!lp || !g?.solo || lp.end?.result || lp.end?.busy) return;
  useStore.setState({ levelPlay: { ...lp, end: { outcome: 'won', busy: true } } });
  const def = levelById(lp.id)!;
  const firstWin = lp.id === st.story.level;
  const local = { won: true, stars: starsOf(g), score: soloScore(g).total, coins: winCoins(def, g, firstWin) };
  const result = await finishAttempt(lp.id, lp.attempt, levelActions(), local);
  // the level 10 board is the first piece of the player's museum collection
  if (lp.id === STORY.TUTORIAL_LEVELS && result.bricks) addToCollection({ tiles: g.players[0].tiles, score: local.score, won: true, opp: tr('story.master') });
  const now = useStore.getState().levelPlay;
  if (now === null || now.id !== lp.id) return;
  useStore.setState({ levelPlay: { ...now, end: { outcome: 'won', result } } });
  sfx.win();
}

/** Leave a lost (or abandoned) level: the server records it (a life after the tutorial; none before the first move). */
async function settleLoss() {
  const st = useStore.getState();
  const lp = st.levelPlay, g = st.game;
  if (!lp) return;
  const actions = levelActions();
  await finishAttempt(lp.id, lp.attempt, actions, { won: false, stars: 0, score: g?.solo ? soloScore(g).total : 0, coins: 0 });
  if (lp.id > STORY.TUTORIAL_LEVELS && actions.length) pushToast(tr('lvl.lifeLost'), 'warn');
}

export async function leaveLevel(): Promise<void> {
  const lp = useStore.getState().levelPlay;
  if (lp?.end?.outcome === 'won') { afterWin(); return; }
  await settleLoss();
  backToMap();
}

export async function retryLevel() {
  const lp = useStore.getState().levelPlay;
  if (!lp) return;
  await settleLoss();
  backToMap();
  openLevel(lp.id);
}

/** A classic continue: +6 track cells and +5 coins (free in the tutorial, paid with coins after it). */
export async function continueLevel(): Promise<'ok' | 'coins' | 'offline' | 'error'> {
  const lp = useStore.getState().levelPlay;
  if (!lp) return 'error';
  const paid = await payContinue(lp.attempt.attemptId);
  if (paid !== true) return paid;
  useStore.setState({ levelPlay: { ...lp, end: null } });
  send.solo({ t: 'continue' });
  return 'ok';
}

/** After the win card: the outro (level 10: the unlock scene), then the map. */
function afterWin() {
  const lp = useStore.getState().levelPlay;
  const unlocked = !!lp?.end?.result?.unlockedNow;
  backToMap();
  if (unlocked) {
    showDialog(UNLOCK, () => {
      try { if (localStorage.getItem(TOUR_KEY)) return; localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
      useStore.setState({ unlockTour: 'battle' });
    });
  }
}

/** The first launch goes straight into level 1 (its intro first). */
export function firstLaunch(): boolean {
  const st = useStore.getState().story;
  if (st.unlocked || st.level > 1 || Object.keys(st.results).length) return false;
  void beginLevel(1, false);
  return true;
}
