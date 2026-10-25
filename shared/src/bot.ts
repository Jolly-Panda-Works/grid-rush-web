import { BOARD_SIZE, REWARD_POSITIONS, TREASURE_POSITIONS, COIN_SCORE_DIVISOR } from './constants';
import { allPlacements, applyAction, boardFull, cellIdx, cloneForSim, emptyCount, engravedTotal, other } from './engine';
import type { Action, GameState, PlayerState, Rng, Seat } from './types';

interface TierCfg { randomChance: number; noise: number; endAware: boolean; holeWeight: number }
const TIERS: TierCfg[] = [
  { randomChance: 0.3, noise: 6, endAware: false, holeWeight: 0.3 },
  { randomChance: 0.12, noise: 3.5, endAware: false, holeWeight: 0.7 },
  { randomChance: 0.04, noise: 2, endAware: true, holeWeight: 1 },
  { randomChance: 0, noise: 0.8, endAware: true, holeWeight: 1.2 },
  { randomChance: 0, noise: 0, endAware: true, holeWeight: 1.4 },
];
export const BOT_TIER_NAMES = ['Rookie', 'Casual', 'Skilled', 'Expert', 'Master'];

/** Bot difficulty from the human's level + rating. */
export function botTierFor(level: number, rating: number): number {
  const eff = rating + Math.min(level, 30) * 8;
  if (eff < 1000) return 1;
  if (eff < 1130) return 2;
  if (eff < 1280) return 3;
  if (eff < 1430) return 4;
  return 5;
}

function holePenalty(p: PlayerState): number {
  const seen = new Set<number>();
  let pen = 0;
  for (let i = 0; i < p.board.length; i++) {
    if (p.board[i] !== 0 || seen.has(i)) continue;
    let size = 0;
    const stack = [i];
    seen.add(i);
    while (stack.length) {
      const cur = stack.pop() as number;
      size++;
      const r = Math.floor(cur / BOARD_SIZE), c = cur % BOARD_SIZE;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= BOARD_SIZE || nc >= BOARD_SIZE) continue;
        const ni = cellIdx(nr, nc);
        if (p.board[ni] === 0 && !seen.has(ni)) { seen.add(ni); stack.push(ni); }
      }
    }
    pen += size === 1 ? 2 : size === 2 ? 0.6 : size === 3 ? 0.2 : 0;
  }
  return pen;
}

function futureTreasure(p: PlayerState): number {
  const ahead = TREASURE_POSITIONS.filter((t) => t > p.pos).length;
  return engravedTotal(p) * ahead * 0.8;
}
function futureRewards(p: PlayerState, s: GameState): number {
  return REWARD_POSITIONS.filter((rp, i) => rp > p.pos && !s.rewardTaken[i]).length * 0.4;
}

const COIN_SPEND_VALUE = 0.2;

function value(sim: GameState, seat: Seat, cfg: TierCfg): number {
  if (sim.phase === 'finished') {
    const win = sim.result?.winner === seat;
    return (win ? 1 : -1) * (cfg.endAware ? 10000 : 150);
  }
  const me = sim.players[seat], op = sim.players[other(seat)];
  // a coin scores 1/COIN_SCORE_DIVISOR at the end; COIN_SPEND_VALUE is what it is still worth for buying tiles
  const coinValue = 1 / COIN_SCORE_DIVISOR + COIN_SPEND_VALUE;
  const side = (p: PlayerState) =>
    coinValue * (p.coins + futureTreasure(p)) + 2 * (BOARD_SIZE * BOARD_SIZE - emptyCount(p)) + (p.bonus7 ? 7 : 0);
  let v = side(me) - side(op);
  v -= holePenalty(me) * cfg.holeWeight;
  v += holePenalty(op) * 0.2;
  v -= 0.7 * me.pos;                 // time is a resource, and my position feeds the opponent's Advance
  v += 0.3 * op.pos * 0;             // (kept explicit: opponent position is not controllable by me)
  v += futureRewards(me, sim);
  if (sim.phase === 'placing_reward' && sim.current === seat) v += 2.5 * sim.pendingRewards;
  if (sim.current === seat) v += 1.5; // keeping the turn is a tempo gain
  return v;
}

export function legalActions(s: GameState, seat: Seat): Action[] {
  const me = s.players[seat];
  if (s.phase === 'placing_reward') {
    const out: Action[] = [];
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (me.board[cellIdx(r, c)] === 0) out.push({ t: 'reward', r, c });
    return out;
  }
  const out: Action[] = [{ t: 'advance' }];
  s.offer.forEach((tile, offer) => {
    if (tile.coinCost > me.coins) return;
    for (const cells of allPlacements(me.board, tile.cells)) out.push({ t: 'buy', offer, cells });
  });
  return out;
}

export function chooseAction(s: GameState, seat: Seat, tier: number, rng: Rng = Math.random): Action {
  const cfg = TIERS[Math.max(1, Math.min(5, tier)) - 1];
  const cands = legalActions(s, seat);
  if (cands.length === 0) return { t: 'advance' };
  if (cfg.randomChance > 0 && rng() < cfg.randomChance) return cands[Math.floor(rng() * cands.length)];
  let best = cands[0];
  let bestV = -Infinity;
  for (const a of cands) {
    const sim = cloneForSim(s);
    if (applyAction(sim, seat, a, Math.random) !== null) continue;
    const v = value(sim, seat, cfg) + (cfg.noise ? (rng() * 2 - 1) * cfg.noise : 0);
    if (v > bestV) { bestV = v; best = a; }
  }
  return best;
}

export { boardFull };
