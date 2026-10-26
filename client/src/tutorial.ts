import { Action, GameState, Seat, TileDef, allPlacements, shapeCells } from '../../shared/src';

/**
 * The first-launch tutorial: a real game against a bot with everything scripted, so each rule shows up exactly once.
 *   1. buy    : buy the first card (an L tile) and place it.
 *   (the bot buys a long tile and jumps to cell 5)
 *   2. rotate : buy a 1x4 tile; it must be placed standing, picked from the strip of shapes.
 *   3. advance: no coins left, so Advance: jump just past the bot, 1 coin per cell.
 *   4. coins  : that move passed a treasure (cell 5), which paid 1 coin per engraved coin on your tiles.
 *   5. reward : and it landed on the 1x1 reward (cell 6): place it.
 *   6. done
 */
export type TutStep = 'buy' | 'wait' | 'rotate' | 'advance' | 'coins' | 'reward' | 'done';

const tile = (uid: number, shape: string, coinCost: number, timeCost: number, engraved: number): TileDef =>
  ({ uid, shape, cells: shapeCells(shape), coinCost, timeCost, engraved });

/** Sets up the scripted opening: the human (seat 0) starts with three fixed cards. */
export function setupTutorial(g: GameState) {
  g.current = 0;
  g.offer = [tile(901, 'l3', 2, 2, 1), tile(902, 't5', 9, 4, 2), tile(903, 'p5', 4, 5, 0)];
  g.next = tile(904, 'i4', 3, 1, 1); // slides into the first slot once the L tile is bought
  g.nextUid = 1000;
}

/** After every action: the card the engine drew as the next one is swapped for an expensive filler, so the human
 *  runs out of coins on cue (the scripted 1x4, uid 904, is left alone until it has come in). */
let fillers = 0;
export function tutorialFixup(g: GameState) {
  if (g.next.uid === 904 || g.next.uid >= 5000) return;
  const n = fillers++;
  g.next = n % 2 ? tile(5000 + n, 'v5', 7, 4, 1) : tile(5000 + n, 'x5', 8, 5, 2);
}

/** Which step the game is at (from the human's point of view). */
export function tutorialStep(g: GameState, me: Seat, coinsSeen: boolean): TutStep {
  const p = g.players[me];
  if (g.phase === 'placing_reward' && g.current === me) return coinsSeen ? 'reward' : 'coins';
  if (g.current !== me) return p.tiles.length >= 3 ? 'done' : 'wait';
  if (p.tiles.length === 0) return 'buy';
  if (p.tiles.length === 1) return 'rotate';
  if (p.tiles.length === 2) return 'advance';
  return 'done';
}

/** The bot's scripted move: buy the long p5 card (it jumps to cell 5, just before the treasure and the 1x1). */
export function tutorialBotAction(g: GameState, seat: Seat): Action {
  const i = g.offer.findIndex((t) => t.uid === 903);
  if (i >= 0) {
    const spots = allPlacements(g.players[seat].board, g.offer[i].cells);
    if (spots.length) return { t: 'buy', offer: i, cells: spots[Math.floor(spots.length / 2)] };
  }
  return { t: 'advance' };
}

/** null = allowed; otherwise the i18n key of the hint to show instead. */
export function tutorialBlocks(g: GameState, me: Seat, a: Action, coinsSeen: boolean): string | null {
  const step = tutorialStep(g, me, coinsSeen);
  if (step === 'buy') return a.t === 'buy' && g.offer[a.offer]?.uid === 901 ? null : 'tut.only.buy';
  if (step === 'rotate') {
    if (a.t !== 'buy' || g.offer[a.offer]?.uid !== 904) return 'tut.only.rotate';
    return new Set(a.cells.map((c) => c[1])).size === 1 ? null : 'tut.only.standing'; // all in one column = standing
  }
  if (step === 'advance') return a.t === 'advance' ? null : 'tut.only.advance';
  if (step === 'coins') return 'tut.only.next';
  if (step === 'reward') return a.t === 'reward' ? null : 'tut.only.reward';
  return null;
}

const KEY = 'gridrush.tutorial.v1';
export const tutorialDone = () => { try { return localStorage.getItem(KEY) === 'done'; } catch { return true; } };
export const markTutorialDone = () => { try { localStorage.setItem(KEY, 'done'); } catch { /* ignore */ } };
