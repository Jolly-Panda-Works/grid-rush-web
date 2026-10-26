// A goal-aware greedy player for story levels: checks that every level can be won, and gives a first guess of
// how hard it is (npm run test:levels). Real difficulty comes from playtests.
import { BOARD_SIZE } from '../constants';
import { cellIdx, cellsKey, cloneForSim, orientations } from '../engine';
import { SHAPES, shapeCells } from '../tiles';
import { legalActions } from '../bot';
import type { GameState, Rng } from '../types';
import { applySoloAction, goalProgress, goalsDone, soloScore, starsOf } from './solo';
import type { LevelDef, SoloAction, SoloOptions } from './solo';
import { createSoloGame } from './solo';

/** Every shape a single tile can have, in every orientation: a small hole of one of these can still be filled. */
const FITS = new Set(Object.keys(SHAPES).flatMap((id) => orientations(shapeCells(id)).map(cellsKey)));

function holes(s: GameState, giftsLeft: number): number {
  const b = s.players[0].board;
  const seen = new Set<number>();
  let pen = 0;
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== 0 || seen.has(i)) continue;
    let size = 0;
    const stack = [i];
    const cells: [number, number][] = [];
    seen.add(i);
    while (stack.length) {
      const cur = stack.pop() as number;
      size++;
      cells.push([Math.floor(cur / BOARD_SIZE), cur % BOARD_SIZE]);
      const r = Math.floor(cur / BOARD_SIZE), c = cur % BOARD_SIZE;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= BOARD_SIZE || nc >= BOARD_SIZE) continue;
        const ni = cellIdx(nr, nc);
        if (b[ni] === 0 && !seen.has(ni)) { seen.add(ni); stack.push(ni); }
      }
    }
    // a hole no single tile fits needs several tiles (or a 1x1 gift); the smaller, the worse
    if (size === 1) pen += giftsLeft-- > 0 ? 0.3 : 3;
    else if (size <= 5) pen += FITS.has(cellsKey(cells)) ? 0.3 : 2.5;
    else if (size <= 8) pen += 0.3;
  }
  return pen;
}

/** Empty cells of the fullest 7x7 square. */
function best7(s: GameState): number {
  const b = s.players[0].board;
  let best = 49;
  for (let r0 = 0; r0 <= BOARD_SIZE - 7; r0++) for (let c0 = 0; c0 <= BOARD_SIZE - 7; c0++) {
    let n = 0;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (b[cellIdx(r0 + r, c0 + c)] <= 0) n++;
    best = Math.min(best, n);
  }
  return best;
}

function value(s: GameState): number {
  const solo = s.solo!;
  if (solo.outcome === 'won') return 1e6 + soloScore(s).total;
  if (solo.outcome === 'lost') return -1e6;
  let v = 0;
  for (const g of goalProgress(s)) {
    const missing = Math.max(0, g.goal.type === 'max_empty' ? g.have - g.need : g.need - g.have);
    if (g.goal.type === 'bonus7') v -= 30 * best7(s);
    else if (g.goal.type === 'min_coins' || g.goal.type === 'min_score') v -= 6 * missing;
    else v -= 30 * missing;
  }
  const me = s.players[0];
  const tight = solo.goals.some((g) => g.type === 'fill_board' || g.type === 'max_empty' || g.type === 'fill_region' || g.type === 'bonus7');
  const giftsLeft = (s.track?.rewards ?? []).filter((p, i) => p > me.pos && !s.rewardTaken[i]).length + s.pendingRewards;
  v -= holes(s, giftsLeft) * (tight ? 12 : 3);
  v += soloScore(s).total * 2 + me.coins * 0.8 - me.pos * 1.2;
  return v;
}

export interface SolveResult { won: boolean; stars: number; score: number; actions: SoloAction[]; continues: number }

/** Plays a level greedily (with `noise` for a weaker player). Ends as soon as the goals are done. */
export function solveLevel(level: LevelDef, opts: SoloOptions = {}, noise = 0, rng: Rng = Math.random, continues = 0): SolveResult {
  const s = createSoloGame(level, opts);
  const actions: SoloAction[] = [];
  let used = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (s.solo!.outcome === 'lost' && used < continues) { applySoloAction(s, { t: 'continue' }); actions.push({ t: 'continue' }); used++; continue; }
    if (s.solo!.outcome) break;
    if (goalsDone(s)) { applySoloAction(s, { t: 'finish' }); actions.push({ t: 'finish' }); break; }
    let best: SoloAction | null = null, bestV = -Infinity;
    for (const a of legalActions(s, 0)) {
      const sim = cloneForSim(s);
      if (applySoloAction(sim, a)) continue;
      const v = value(sim) + (noise ? (rng() * 2 - 1) * noise : 0);
      if (v > bestV) { bestV = v; best = a; }
    }
    if (!best) break;
    applySoloAction(s, best);
    actions.push(best);
  }
  return { won: s.solo!.outcome === 'won', stars: starsOf(s), score: soloScore(s).total, actions, continues: used };
}
